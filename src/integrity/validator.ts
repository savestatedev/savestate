/**
 * Integrity Validator
 * 
 * Validates memories and checkpoints against integrity policies.
 */

import { createHash } from 'crypto';
import {
  IntegrityMetadata,
  IntegrityPolicy,
  ValidityStatus,
  InvalidReason,
  ValidationRule,
  EvidenceBundle,
  EvidenceItem,
} from './types.js';

/**
 * Default integrity policy
 */
export const DEFAULT_POLICY: IntegrityPolicy = {
  version: '1.0.0',
  name: 'default',
  rules: [
    {
      rule_id: 'ttl-check',
      name: 'TTL Expiration Check',
      description: 'Check if memory has exceeded its time-to-live',
      severity: 'error',
      condition: { type: 'ttl_check', max_age_s: 86400 * 30 }, // 30 days
      enabled: true,
    },
    {
      rule_id: 'evidence-required',
      name: 'Evidence Required',
      description: 'High-risk actions require evidence bundle',
      severity: 'warning',
      condition: { type: 'evidence_required' },
      enabled: true,
    },
  ],
  default_retrieval_mode: 'stable_only',
  strict_mode: false,
  created_at: new Date().toISOString(),
};

/**
 * Validation result for a single rule
 */
export interface RuleValidationResult {
  rule_id: string;
  rule_name: string;
  passed: boolean;
  severity: 'warning' | 'error' | 'critical';
  message?: string;
}

/**
 * Full validation result
 */
export interface ValidationResult {
  /** Overall pass/fail */
  valid: boolean;
  
  /** New validity status based on validation */
  status: ValidityStatus;
  
  /** Individual rule results */
  rule_results: RuleValidationResult[];
  
  /** Warnings (non-blocking) */
  warnings: string[];
  
  /** Errors (blocking in strict mode) */
  errors: string[];
  
  /** Policy version used */
  policy_version: string;
  
  /** Timestamp of validation */
  validated_at: string;
}

/**
 * Data to validate (memory, checkpoint, etc.)
 */
export interface ValidatableData {
  /** When the data was created */
  created_at: string;
  
  /** TTL in seconds (if any) */
  ttl_s?: number;
  
  /** Current integrity metadata */
  integrity?: IntegrityMetadata;
  
  /** Evidence bundle hash */
  evidence_bundle_hash?: string;
  
  /** Source revision */
  source_revision?: string;
  
  /** Additional context for validation */
  context?: Record<string, unknown>;
}

/**
 * Integrity Validator Service
 */
export class IntegrityValidator {
  constructor(private policy: IntegrityPolicy = DEFAULT_POLICY) {}

  /**
   * Get the current policy
   */
  getPolicy(): IntegrityPolicy {
    return this.policy;
  }

  /**
   * Update the policy
   */
  setPolicy(policy: IntegrityPolicy): void {
    this.policy = policy;
  }

  /**
   * Validate data against the current policy
   */
  validate(data: ValidatableData): ValidationResult {
    const results: RuleValidationResult[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    const validated_at = new Date().toISOString();

    for (const rule of this.policy.rules) {
      if (!rule.enabled) continue;

      const result = this.evaluateRule(rule, data);
      results.push(result);

      if (!result.passed) {
        const msg = result.message || `Rule ${rule.name} failed`;
        if (rule.severity === 'warning') {
          warnings.push(msg);
        } else {
          errors.push(msg);
        }
      }
    }

    // Determine overall status
    let status: ValidityStatus = 'valid';
    let valid = true;

    if (errors.length > 0) {
      status = this.policy.strict_mode ? 'invalid' : 'suspect';
      valid = !this.policy.strict_mode;
    } else if (warnings.length > 0) {
      status = 'suspect';
    }

    return {
      valid,
      status,
      rule_results: results,
      warnings,
      errors,
      policy_version: this.policy.version,
      validated_at,
    };
  }

  /**
   * Evaluate a single rule against data
   */
  private evaluateRule(rule: ValidationRule, data: ValidatableData): RuleValidationResult {
    const condition = rule.condition;

    switch (condition.type) {
      case 'ttl_check':
        return this.checkTTL(rule, data, condition.max_age_s);

      case 'evidence_required':
        return this.checkEvidenceRequired(rule, data);

      case 'source_check':
        return this.checkSource(rule, data, condition.require_hash);

      case 'policy_version_check':
        return this.checkPolicyVersion(rule, data, condition.min_version);

      case 'custom':
        // Custom rules would be evaluated via a plugin system
        return {
          rule_id: rule.rule_id,
          rule_name: rule.name,
          passed: true, // Skip custom rules for now
          severity: rule.severity,
          message: 'Custom rule evaluation not implemented',
        };

      default:
        return {
          rule_id: rule.rule_id,
          rule_name: rule.name,
          passed: true,
          severity: rule.severity,
        };
    }
  }

  /**
   * Check TTL expiration
   */
  private checkTTL(
    rule: ValidationRule,
    data: ValidatableData,
    maxAgeS: number
  ): RuleValidationResult {
    const created = new Date(data.created_at).getTime();
    const now = Date.now();
    const ageS = (now - created) / 1000;

    // Use data's TTL if specified, otherwise use rule's max_age_s
    const effectiveTTL = data.ttl_s ?? maxAgeS;

    const passed = ageS <= effectiveTTL;

    return {
      rule_id: rule.rule_id,
      rule_name: rule.name,
      passed,
      severity: rule.severity,
      message: passed
        ? undefined
        : `Data exceeded TTL: age=${Math.round(ageS)}s, ttl=${effectiveTTL}s`,
    };
  }

  /**
   * Check evidence bundle requirement
   */
  private checkEvidenceRequired(
    rule: ValidationRule,
    data: ValidatableData
  ): RuleValidationResult {
    const hasEvidence = !!data.evidence_bundle_hash;

    return {
      rule_id: rule.rule_id,
      rule_name: rule.name,
      passed: hasEvidence,
      severity: rule.severity,
      message: hasEvidence ? undefined : 'Evidence bundle hash required but missing',
    };
  }

  /**
   * Check source revision
   */
  private checkSource(
    rule: ValidationRule,
    data: ValidatableData,
    requireHash: boolean
  ): RuleValidationResult {
    if (!requireHash) {
      return {
        rule_id: rule.rule_id,
        rule_name: rule.name,
        passed: true,
        severity: rule.severity,
      };
    }

    const hasSourceRevision = !!data.source_revision;

    return {
      rule_id: rule.rule_id,
      rule_name: rule.name,
      passed: hasSourceRevision,
      severity: rule.severity,
      message: hasSourceRevision
        ? undefined
        : 'Source revision required but missing',
    };
  }

  /**
   * Check policy version
   */
  private checkPolicyVersion(
    rule: ValidationRule,
    data: ValidatableData,
    minVersion: string
  ): RuleValidationResult {
    const dataVersion = data.integrity?.policy_version;

    if (!dataVersion) {
      return {
        rule_id: rule.rule_id,
        rule_name: rule.name,
        passed: false,
        severity: rule.severity,
        message: 'No policy version found on data',
      };
    }

    // Simple semver comparison (major.minor.patch)
    const passed = this.compareSemver(dataVersion, minVersion) >= 0;

    return {
      rule_id: rule.rule_id,
      rule_name: rule.name,
      passed,
      severity: rule.severity,
      message: passed
        ? undefined
        : `Policy version ${dataVersion} is below minimum ${minVersion}`,
    };
  }

  /**
   * Simple semver comparison (-1, 0, 1)
   */
  private compareSemver(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;
      if (partA > partB) return 1;
      if (partA < partB) return -1;
    }

    return 0;
  }

  /**
   * Create initial integrity metadata for new data
   */
  createIntegrityMetadata(options?: {
    ttl_s?: number;
    source_revision?: string;
    evidence_bundle_hash?: string;
  }): IntegrityMetadata {
    return {
      validity_status: 'valid',
      ttl_s: options?.ttl_s,
      source_revision: options?.source_revision,
      evidence_bundle_hash: options?.evidence_bundle_hash,
      policy_version: this.policy.version,
      last_validated_at: new Date().toISOString(),
    };
  }

  /**
   * Mark data as invalid
   */
  markInvalid(
    metadata: IntegrityMetadata,
    reason: InvalidReason
  ): IntegrityMetadata {
    return {
      ...metadata,
      validity_status: 'invalid',
      invalid_reason: reason,
      invalidated_at: new Date().toISOString(),
    };
  }

  /**
   * Mark data as suspect
   */
  markSuspect(metadata: IntegrityMetadata): IntegrityMetadata {
    return {
      ...metadata,
      validity_status: 'suspect',
      last_validated_at: new Date().toISOString(),
    };
  }

  /**
   * Revalidate and update metadata
   */
  revalidate(
    metadata: IntegrityMetadata,
    data: ValidatableData
  ): IntegrityMetadata {
    const result = this.validate(data);

    return {
      ...metadata,
      validity_status: result.status,
      policy_version: result.policy_version,
      last_validated_at: result.validated_at,
      invalid_reason: result.status === 'invalid' ? 'policy_violation' : undefined,
      invalidated_at: result.status === 'invalid' ? result.validated_at : undefined,
    };
  }
}

// ─── Evidence Bundle Utilities ───────────────────────────────

/**
 * Create a hash for an evidence bundle
 */
export function hashEvidenceBundle(items: EvidenceItem[]): string {
  const content = JSON.stringify(
    items.map(i => ({
      type: i.type,
      reference: i.reference,
      content_hash: i.content_hash,
      timestamp: i.timestamp,
    }))
  );

  return createHash('sha256').update(content).digest('hex');
}

/**
 * Create an evidence bundle
 */
export function createEvidenceBundle(items: EvidenceItem[]): EvidenceBundle {
  const bundle_id = createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .slice(0, 16);

  return {
    bundle_id,
    items,
    hash: hashEvidenceBundle(items),
    created_at: new Date().toISOString(),
  };
}

/**
 * Verify an evidence bundle hash
 */
export function verifyEvidenceBundle(bundle: EvidenceBundle): boolean {
  const computed = hashEvidenceBundle(bundle.items);
  return computed === bundle.hash;
}
