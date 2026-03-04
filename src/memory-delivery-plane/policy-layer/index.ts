/**
 * Memory Delivery Plane - Policy Layer
 * 
 * Data residency, PII redaction, retention TTL enforcement.
 */

import { TaskPacket } from '../packet-builder/index.js';

/**
 * Data residency region
 */
export enum DataRegion {
  US = 'us',
  EU = 'eu',
  APAC = 'apac',
  GLOBAL = 'global',
}

/**
 * PII detection pattern types
 */
export enum PIIType {
  EMAIL = 'email',
  PHONE = 'phone',
  SSN = 'ssn',
  CREDIT_CARD = 'credit_card',
  IP_ADDRESS = 'ip_address',
  API_KEY = 'api_key',
  PASSWORD = 'password',
}

/**
 * A detected PII entity
 */
export interface PIIEntity {
  type: PIIType;
  value: string;
  startIndex: number;
  endIndex: number;
  redactedValue: string;
}

/**
 * PII redaction result
 */
export interface RedactionResult {
  original: string;
  redacted: string;
  entities: PIIEntity[];
  redactionCount: number;
}

/**
 * Retention policy
 */
export interface RetentionPolicy {
  /** Maximum age in seconds */
  maxAgeSeconds: number;
  
  /** Archive after this period (seconds) */
  archiveAfterSeconds?: number;
  
  /** Delete after this period (seconds) */
  deleteAfterSeconds?: number;
}

/**
 * Policy enforcement result
 */
export interface PolicyResult {
  allowed: boolean;
  violations: string[];
  redactedContent?: string;
  expiredMemories?: string[];
  dataRegion?: DataRegion;
}

/**
 * Tenant policy configuration
 */
export interface PolicyConfig {
  /** Data residency region */
  dataRegion: DataRegion;
  
  /** Allowed regions (for data residency compliance) */
  allowedRegions?: DataRegion[];
  
  /** Enable PII detection */
  enablePIIDetection: boolean;
  
  /** PII types to redact */
  piiTypesToRedact: PIIType[];
  
  /** Custom PII patterns (regex) */
  customPIIPatterns?: Map<PIIType, RegExp>;
  
  /** Retention policy */
  retention: RetentionPolicy;
  
  /** Block sensitive tags */
  blockedTags?: string[];
  
  /** Require certain tags */
  requiredTags?: string[];
}

/**
 * Built-in PII patterns
 */
const PII_PATTERNS: Record<PIIType, RegExp> = {
  [PIIType.EMAIL]: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  [PIIType.PHONE]: /\b(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  [PIIType.SSN]: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  [PIIType.CREDIT_CARD]: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  [PIIType.IP_ADDRESS]: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  [PIIType.API_KEY]: /\b(?:api[_-]?key|apikey|secret|token)[=:]\s*['"]?[A-Za-z0-9_-]{20,}['"]?/gi,
  [PIIType.PASSWORD]: /\b(?:password|passwd|pwd)[=:]\s*['"]?[^\s'"]{4,}['"]?/gi,
};

/**
 * PolicyLayer - enforces data residency, PII redaction, retention TTL
 */
export class PolicyLayer {
  private config: PolicyConfig;

  constructor(config: Partial<PolicyConfig> = {}) {
    this.config = {
      dataRegion: config.dataRegion ?? DataRegion.GLOBAL,
      allowedRegions: config.allowedRegions ?? Object.values(DataRegion),
      enablePIIDetection: config.enablePIIDetection ?? true,
      piiTypesToRedact: config.piiTypesToRedact ?? Object.values(PIIType),
      customPIIPatterns: config.customPIIPatterns ?? new Map(),
      retention: config.retention ?? {
        maxAgeSeconds: 90 * 24 * 60 * 60, // 90 days default
      },
      blockedTags: config.blockedTags ?? [],
      requiredTags: config.requiredTags ?? [],
    };
  }

  /**
   * Get pattern for a PII type (custom or built-in)
   */
  private getPattern(piiType: PIIType): RegExp {
    const custom = this.config.customPIIPatterns?.get(piiType);
    if (custom) return custom;
    return PII_PATTERNS[piiType];
  }

  /**
   * Redact a PII value
   */
  private redactValue(type: PIIType, value: string): string {
    switch (type) {
      case PIIType.EMAIL:
        const [local, domain] = value.split('@');
        return `${local?.substring(0, 2) ?? 'xx'}***@${domain ?? 'domain.com'}`;
      case PIIType.PHONE:
        return '***-***-****';
      case PIIType.SSN:
        return '***-**-****';
      case PIIType.CREDIT_CARD:
        return '****-****-****-****';
      case PIIType.IP_ADDRESS:
        const parts = value.split('.');
        return `${parts[0]}.${parts[1]}.***.***`;
      case PIIType.API_KEY:
        return '[REDACTED_API_KEY]';
      case PIIType.PASSWORD:
        return '[REDACTED_PASSWORD]';
      default:
        return '***';
    }
  }

  /**
   * Detect and redact PII in content
   */
  redactPII(content: string): RedactionResult {
    const entities: PIIEntity[] = [];
    let redacted = content;

    for (const piiType of this.config.piiTypesToRedact) {
      if (!this.config.enablePIIDetection) break;

      const pattern = this.getPattern(piiType);
      let match: RegExpExecArray | null;

      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;

      while ((match = pattern.exec(content)) !== null) {
        const value = match[0];
        const redactedValue = this.redactValue(piiType, value);

        entities.push({
          type: piiType,
          value,
          startIndex: match.index,
          endIndex: match.index + value.length,
          redactedValue,
        });

        // Replace in redacted content
        redacted = redacted.replace(value, redactedValue);
      }
    }

    // Sort entities by position (reverse order for replacement)
    entities.sort((a, b) => b.startIndex - a.startIndex);

    return {
      original: content,
      redacted,
      entities,
      redactionCount: entities.length,
    };
  }

  /**
   * Check if memory is expired based on retention policy
   */
  isExpired(createdAt: string): boolean {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    const ageSeconds = (now - created) / 1000;
    return ageSeconds > this.config.retention.maxAgeSeconds;
  }

  /**
   * Calculate remaining TTL
   */
  getRemainingTTL(createdAt: string): number | null {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    const ageSeconds = (now - created) / 1000;
    const remaining = this.config.retention.maxAgeSeconds - ageSeconds;
    return remaining > 0 ? remaining : null;
  }

  /**
   * Check data region compliance
   */
  checkDataRegion(targetRegion: DataRegion): boolean {
    return this.config.allowedRegions?.includes(targetRegion) ?? true;
  }

  /**
   * Validate tags
   */
  validateTags(tags: string[]): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check blocked tags
    for (const tag of tags) {
      if (this.config.blockedTags?.includes(tag)) {
        violations.push(`Blocked tag: ${tag}`);
      }
    }

    // Check required tags
    if (this.config.requiredTags?.length) {
      const missing = this.config.requiredTags.filter(
        required => !tags.includes(required)
      );
      if (missing.length > 0) {
        violations.push(`Missing required tags: ${missing.join(', ')}`);
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Enforce policies on a packet
   */
  enforce(packet: TaskPacket): PolicyResult {
    const violations: string[] = [];
    let redactedContent: string | undefined;

    // Check data region
    if (!this.checkDataRegion(this.config.dataRegion)) {
      violations.push(`Data region ${this.config.dataRegion} not in allowed regions`);
    }

    // Check and redact PII in each memory
    const expiredMemories: string[] = [];
    
    for (const memory of packet.memories) {
      // Check for expired memories
      if (this.isExpired(memory.created_at)) {
        expiredMemories.push(memory.memory_id);
        continue;
      }

      // Redact PII
      if (this.config.enablePIIDetection) {
        const redaction = this.redactPII(memory.content);
        if (redaction.redactionCount > 0) {
          memory.content = redaction.redacted;
          redactedContent = redaction.redacted;
        }
      }

      // Validate tags
      if (memory.tags?.length) {
        const tagValidation = this.validateTags(memory.tags);
        violations.push(...tagValidation.violations);
      }
    }

    // Remove expired memories
    if (expiredMemories.length > 0) {
      packet.memories = packet.memories.filter(
        m => !expiredMemories.includes(m.memory_id)
      );
      violations.push(`Removed ${expiredMemories.length} expired memories`);
    }

    return {
      allowed: violations.length === 0,
      violations,
      redactedContent,
      expiredMemories,
      dataRegion: this.config.dataRegion,
    };
  }

  /**
   * Enforce policies on multiple packets
   */
  enforceBatch(packets: TaskPacket[]): Map<string, PolicyResult> {
    const results = new Map<string, PolicyResult>();
    
    for (const packet of packets) {
      results.set(packet.packet_id, this.enforce(packet));
    }
    
    return results;
  }

  /**
   * Get current configuration
   */
  getConfig(): PolicyConfig {
    return { 
      ...this.config, 
      customPIIPatterns: this.config.customPIIPatterns 
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PolicyConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

export default PolicyLayer;
