/**
 * Core Integrity v1 Types
 * 
 * Ensures memory/state integrity at retrieval and action time
 * with verifiable provenance.
 * 
 * @see https://github.com/savestatedev/savestate/issues/68
 */

// ─── Validity Status ─────────────────────────────────────────

/**
 * Validity status for memories and state objects.
 */
export type ValidityStatus = 
  | 'valid'          // Verified and safe to use
  | 'suspect'        // May have issues, use with caution
  | 'invalid'        // Known to be incorrect/outdated
  | 'unverified';    // Not yet checked

/**
 * Reasons why a memory might be invalid.
 */
export type InvalidReason =
  | 'source_changed'      // Original source has been modified
  | 'ttl_expired'         // Time-to-live exceeded
  | 'manual_invalidation' // Explicitly marked invalid
  | 'conflict_detected'   // Conflicts with newer information
  | 'evidence_missing'    // Supporting evidence no longer available
  | 'policy_violation';   // Violates current policy rules

// ─── Core Integrity Fields ───────────────────────────────────

/**
 * Integrity metadata for any stateful object (memory, checkpoint, etc.)
 */
export interface IntegrityMetadata {
  /** Source code/document revision this came from */
  source_revision?: string;
  
  /** Time-to-live in seconds (from creation) */
  ttl_s?: number;
  
  /** Current validity status */
  validity_status: ValidityStatus;
  
  /** Reason for invalidity (if status is 'invalid') */
  invalid_reason?: InvalidReason;
  
  /** ISO timestamp when invalidated */
  invalidated_at?: string;
  
  /** Hash of the evidence bundle supporting this data */
  evidence_bundle_hash?: string;
  
  /** Policy version this was validated against */
  policy_version?: string;
  
  /** ISO timestamp of last validation check */
  last_validated_at?: string;
}

/**
 * Evidence bundle for provenance tracking.
 */
export interface EvidenceBundle {
  /** Unique bundle identifier */
  bundle_id: string;
  
  /** Evidence items in this bundle */
  items: EvidenceItem[];
  
  /** SHA-256 hash of bundle contents */
  hash: string;
  
  /** ISO timestamp when bundle was created */
  created_at: string;
}

export interface EvidenceItem {
  /** Type of evidence */
  type: 'source_document' | 'api_response' | 'user_input' | 'agent_reasoning' | 'tool_output';
  
  /** Reference to the source (URL, file path, etc.) */
  reference: string;
  
  /** Content hash or checksum */
  content_hash?: string;
  
  /** Timestamp of the evidence */
  timestamp: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ─── Retrieval Modes ─────────────────────────────────────────

/**
 * Memory retrieval modes for different trust levels.
 */
export type RetrievalMode = 
  | 'stable_only'     // Only return valid, verified memories
  | 'include_suspect' // Include suspect but flag them
  | 'execute_safe';   // Pre-validated for action execution

/**
 * Options for memory retrieval with integrity checking.
 */
export interface IntegrityRetrievalOptions {
  /** Retrieval mode determining trust level */
  mode: RetrievalMode;
  
  /** Minimum policy version to accept */
  min_policy_version?: string;
  
  /** Whether to revalidate before returning */
  revalidate?: boolean;
  
  /** Maximum age for cached validations (seconds) */
  max_validation_age_s?: number;
}

/**
 * Result of integrity-aware retrieval.
 */
export interface IntegrityRetrievalResult<T> {
  /** The retrieved data */
  data: T;
  
  /** Integrity metadata */
  integrity: IntegrityMetadata;
  
  /** Whether this passed integrity checks for the requested mode */
  passed_checks: boolean;
  
  /** Any warnings about the data */
  warnings: string[];
  
  /** Evidence bundle hash if available */
  evidence_hash?: string;
}

// ─── Checkpoint Integrity ────────────────────────────────────

/**
 * Extended checkpoint fields for integrity tracking.
 */
export interface CheckpointIntegrityFields {
  /** Policy version at checkpoint creation */
  policy_version: string;
  
  /** Hash of evidence bundle for this checkpoint */
  evidence_bundle_hash: string;
  
  /** Validity status of the checkpoint itself */
  validity_status: ValidityStatus;
  
  /** Memory validity summary at checkpoint time */
  memory_validity_summary: {
    total: number;
    valid: number;
    suspect: number;
    invalid: number;
    unverified: number;
  };
}

// ─── Decision Guard (Post-GA) ────────────────────────────────

/**
 * Action evaluation request for Decision Guard.
 * Note: This is scoped for post-GA pilot only.
 */
export interface ActionEvaluationRequest {
  /** Idempotency key to prevent duplicate evaluations */
  idempotency_key: string;
  
  /** The action being evaluated */
  action: {
    type: string;
    payload: Record<string, unknown>;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
  };
  
  /** Memories being used for this action */
  memory_refs: string[];
  
  /** Current checkpoint ID */
  checkpoint_id?: string;
  
  /** Actor context */
  actor: {
    id: string;
    type: 'agent' | 'user' | 'system';
  };
}

/**
 * Action evaluation result from Decision Guard.
 */
export interface ActionEvaluationResult {
  /** Whether the action is approved */
  approved: boolean;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Reasons for the decision */
  reasons: string[];
  
  /** Memories that failed integrity checks */
  failed_memories: Array<{
    memory_id: string;
    reason: string;
  }>;
  
  /** Recommended actions if not approved */
  recommendations?: string[];
  
  /** Evaluation timestamp */
  evaluated_at: string;
  
  /** Policy version used for evaluation */
  policy_version: string;
}

// ─── Validation Rules ────────────────────────────────────────

/**
 * Validation rule for integrity checking.
 */
export interface ValidationRule {
  /** Unique rule identifier */
  rule_id: string;
  
  /** Rule name */
  name: string;
  
  /** Rule description */
  description: string;
  
  /** Rule severity */
  severity: 'warning' | 'error' | 'critical';
  
  /** Rule condition (evaluated against memory/checkpoint) */
  condition: ValidationCondition;
  
  /** Whether this rule is enabled */
  enabled: boolean;
}

export type ValidationCondition = 
  | { type: 'ttl_check'; max_age_s: number }
  | { type: 'source_check'; require_hash: boolean }
  | { type: 'policy_version_check'; min_version: string }
  | { type: 'evidence_required' }
  | { type: 'custom'; fn: string };

/**
 * Policy configuration for integrity checking.
 */
export interface IntegrityPolicy {
  /** Policy version (semver) */
  version: string;
  
  /** Policy name */
  name: string;
  
  /** Validation rules */
  rules: ValidationRule[];
  
  /** Default retrieval mode */
  default_retrieval_mode: RetrievalMode;
  
  /** Whether to block on validation failures */
  strict_mode: boolean;
  
  /** ISO timestamp when policy was created */
  created_at: string;
}
