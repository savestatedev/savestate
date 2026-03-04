/**
 * Memory Delivery Plane - Policy Layer
 * 
 * Enforces policies for data residency, PII redaction, and retention TTL.
 */

import type { MemoryEntry, TaskPacket } from '../packet-builder/index.js';

/**
 * Data residency regions
 */
export type DataRegion = 
  | 'us' 
  | 'eu' 
  | 'ap' 
  | 'me' 
  | 'global';

/**
 * Retention period options
 */
export type RetentionPeriod = 
  | 'session'
  | '24h'
  | '7d'
  | '30d'
  | '90d'
  | '1y'
  | 'forever';

/**
 * PII detection patterns
 */
export interface PIIPattern {
  type: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * Policy configuration for a tenant
 */
export interface TenantPolicy {
  /** Unique policy identifier */
  id: string;
  /** Tenant ID */
  tenantId: string;
  /** Data residency requirements */
  dataResidency: DataRegion;
  /** Enable PII redaction */
  piiRedaction: boolean;
  /** Custom PII patterns (extends default) */
  customPIIPatterns?: Array<{
    name: string;
    pattern: string;
    replacement?: string;
  }>;
  /** Retention TTL */
  retention: RetentionPeriod;
  /** Whether to encrypt data at rest */
  encryptAtRest: boolean;
  /** Allowed sources for data */
  allowedSources?: string[];
  /** Blocked sources for data */
  blockedSources?: string[];
}

/**
 * Policy enforcement result
 */
export interface EnforcementResult {
  allowed: boolean;
  reason?: string;
  actions: PolicyAction[];
  metadata: {
    piiRedacted: number;
    regionCompliant: boolean;
    retentionDays: number;
  };
}

/**
 * Actions taken by policy enforcement
 */
export type PolicyAction = 
  | { type: 'redact'; field: string; pattern: string }
  | { type: 'block'; reason: string }
  | { type: 'encrypt'; field: string }
  | { type: 'expire'; field: string; ttl: number };

/**
 * Default PII patterns
 */
const DEFAULT_PII_PATTERNS: PIIPattern[] = [
  { type: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },
  { type: 'phone', pattern: /(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g, replacement: '[PHONE]' },
  { type: 'ssn', pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, replacement: '[SSN]' },
  { type: 'credit_card', pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[CREDIT_CARD]' },
  { type: 'ip_address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[IP]' },
  { type: 'date_of_birth', pattern: /\b(?:DOB|dob|Date of Birth)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/gi, replacement: '[DOB]' },
];

/**
 * Retention period to days mapping
 */
const RETENTION_DAYS: Record<RetentionPeriod, number> = {
  'session': 0,
  '24h': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
  'forever': -1,
};

/**
 * Allowed regions for data residency
 */
const REGION_ALLOWLIST: Record<DataRegion, string[]> = {
  'us': ['us-east-1', 'us-west-2'],
  'eu': ['eu-west-1', 'eu-central-1'],
  'ap': ['ap-northeast-1', 'ap-southeast-1'],
  'me': ['me-south-1'],
  'global': ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-northeast-1', 'ap-southeast-1', 'me-south-1'],
};

/**
 * Policy Layer - enforces data residency, PII redaction, and retention TTL
 */
export class PolicyLayer {
  private policies: Map<string, TenantPolicy> = new Map();
  private piiPatterns: PIIPattern[] = [...DEFAULT_PII_PATTERNS];

  constructor() {}

  /**
   * Register a tenant policy
   */
  registerPolicy(policy: TenantPolicy): void {
    // Add custom PII patterns if provided
    if (policy.customPIIPatterns && policy.customPIIPatterns.length > 0) {
      for (const custom of policy.customPIIPatterns) {
        this.piiPatterns.push({
          type: custom.name,
          pattern: new RegExp(custom.pattern, 'gi'),
          replacement: custom.replacement || `[${custom.name.toUpperCase()}]`,
        });
      }
    }
    
    this.policies.set(policy.id, policy);
  }

  /**
   * Get a policy by ID
   */
  getPolicy(policyId: string): TenantPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Get policy by tenant ID
   */
  getPolicyByTenant(tenantId: string): TenantPolicy | undefined {
    for (const policy of this.policies.values()) {
      if (policy.tenantId === tenantId) {
        return policy;
      }
    }
    return undefined;
  }

  /**
   * Enforce policies on memory entries
   */
  enforceMemories(
    memories: MemoryEntry[],
    policyId: string,
    currentRegion?: DataRegion
  ): { memories: MemoryEntry[]; result: EnforcementResult } {
    const policy = this.policies.get(policyId);
    
    if (!policy) {
      return {
        memories,
        result: {
          allowed: false,
          reason: `Policy not found: ${policyId}`,
          actions: [],
          metadata: {
            piiRedacted: 0,
            regionCompliant: false,
            retentionDays: 0,
          },
        },
      };
    }

    const actions: PolicyAction[] = [];
    let piiRedactedCount = 0;

    // Process each memory
    const processedMemories = memories.map(memory => {
      let processed = { ...memory };

      // Source filtering
      if (policy.blockedSources?.includes(processed.source)) {
        actions.push({ type: 'block', reason: `Source blocked: ${processed.source}` });
        return null;
      }

      // PII redaction
      if (policy.piiRedaction) {
        const originalContent = processed.content;
        processed.content = this.redactPII(processed.content);
        if (processed.content !== originalContent) {
          piiRedactedCount++;
          actions.push({ type: 'redact', field: 'content', pattern: 'pii' });
        }
      }

      // Check retention
      if (policy.retention !== 'forever' && policy.retention !== 'session') {
        const memoryAge = Date.now() - new Date(processed.createdAt).getTime();
        const retentionMs = RETENTION_DAYS[policy.retention] * 24 * 60 * 60 * 1000;
        
        if (memoryAge > retentionMs) {
          actions.push({ type: 'expire', field: 'content', ttl: RETENTION_DAYS[policy.retention] });
          return null;
        }
      }

      return processed;
    }).filter((m): m is MemoryEntry => m !== null);

    // Data residency check
    const regionCompliant = this.checkDataResidency(policy.dataResidency, currentRegion);

    return {
      memories: processedMemories,
      result: {
        allowed: regionCompliant,
        reason: regionCompliant ? undefined : `Data residency violation: required ${policy.dataResidency}, got ${currentRegion}`,
        actions,
        metadata: {
          piiRedacted: piiRedactedCount,
          regionCompliant,
          retentionDays: RETENTION_DAYS[policy.retention],
        },
      },
    };
  }

  /**
   * Enforce policies on a task packet
   */
  enforcePacket(
    packet: TaskPacket,
    policyId: string,
    currentRegion?: DataRegion
  ): { packet: TaskPacket; result: EnforcementResult } {
    const { memories, result } = this.enforceMemories(
      packet.memories.map(m => ({
        id: m.id,
        content: m.summary, // Use summary for packet-level enforcement
        source: m.source,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      policyId,
      currentRegion
    );

    // Update packet with filtered memories
    const filteredPacket = {
      ...packet,
      memories: packet.memories.filter(m => 
        memories.some(pm => pm.id === m.id)
      ),
      distilledCount: memories.length,
    };

    return {
      packet: filteredPacket,
      result,
    };
  }

  /**
   * Redact PII from text
   */
  redactPII(text: string): string {
    let redacted = text;
    
    for (const { pattern } of this.piiPatterns) {
      redacted = redacted.replace(pattern, '');
    }
    
    // Clean up extra whitespace
    return redacted.replace(/\s+/g, ' ').trim();
  }

  /**
   * Detect PII in text (without removing)
   */
  detectPII(text: string): Array<{ type: string; match: string; index: number }> {
    const detections: Array<{ type: string; match: string; index: number }> = [];
    
    for (const { type, pattern } of this.piiPatterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        detections.push({
          type,
          match: match[0],
          index: match.index,
        });
      }
    }
    
    return detections;
  }

  /**
   * Check data residency compliance
   */
  checkDataResidency(required: DataRegion, current?: DataRegion): boolean {
    if (!current) {
      // No region specified, allow (defaults to global)
      return true;
    }
    
    const allowed = REGION_ALLOWLIST[required];
    return allowed?.includes(current) || required === 'global';
  }

  /**
   * Get retention days for a period
   */
  static getRetentionDays(period: RetentionPeriod): number {
    return RETENTION_DAYS[period];
  }

  /**
   * Create a default policy
   */
  static createDefaultPolicy(tenantId: string): TenantPolicy {
    return {
      id: `policy-${tenantId}`,
      tenantId,
      dataResidency: 'global',
      piiRedaction: true,
      retention: '30d',
      encryptAtRest: true,
    };
  }
}

export default PolicyLayer;
