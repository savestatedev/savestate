/**
 * SaveState Privacy Controls Types
 *
 * Type definitions for PII redaction, deny-list policies,
 * field-level encryption, and deletion attestations.
 */

// ─── PII Detection ───────────────────────────────────────────

/**
 * Types of PII that can be detected and redacted.
 */
export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'ip_address'
  | 'date_of_birth'
  | 'address'
  | 'name'
  | 'passport'
  | 'driver_license'
  | 'bank_account'
  | 'api_key'
  | 'password'
  | 'custom';

/**
 * A detected PII instance in content.
 */
export interface PIIMatch {
  /** Type of PII detected */
  type: PIIType;
  /** Starting index in the original content */
  start: number;
  /** Ending index in the original content */
  end: number;
  /** The matched content (before redaction) — only kept for attestation hash */
  originalHash: string;
  /** Confidence score (0-1) for fuzzy matches */
  confidence: number;
}

/**
 * Result of PII detection on content.
 */
export interface PIIDetectionResult {
  /** Original content length */
  originalLength: number;
  /** Number of PII instances found */
  matchCount: number;
  /** Breakdown by PII type */
  matches: PIIMatch[];
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Result of PII redaction on content.
 */
export interface PIIRedactionResult {
  /** Redacted content */
  redacted: string;
  /** Detection details */
  detection: PIIDetectionResult;
  /** Redaction method used */
  method: RedactionMethod;
}

/**
 * How PII should be redacted.
 */
export type RedactionMethod =
  | 'mask'        // Replace with [REDACTED:TYPE]
  | 'hash'        // Replace with deterministic hash (allows dedup)
  | 'tokenize'    // Replace with reversible token (requires key)
  | 'remove';     // Remove entirely

// ─── Deny-List Policy ────────────────────────────────────────

/**
 * A single deny-list rule.
 */
export interface DenyListRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Rule description */
  description?: string;
  /** Pattern type */
  type: 'exact' | 'prefix' | 'suffix' | 'contains' | 'regex' | 'glob';
  /** The pattern to match */
  pattern: string;
  /** Case-sensitive matching (default: false) */
  caseSensitive?: boolean;
  /** What to do when matched */
  action: DenyListAction;
  /** Priority (higher = evaluated first) */
  priority?: number;
  /** Whether this rule is enabled */
  enabled: boolean;
  /** Optional expiration date */
  expiresAt?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Action to take when a deny-list rule matches.
 */
export type DenyListAction =
  | 'block'       // Prevent storage entirely
  | 'redact'      // Redact the matching content
  | 'encrypt'     // Encrypt with field-level encryption
  | 'warn'        // Log warning but allow
  | 'audit';      // Allow but create audit entry

/**
 * Deny-list policy configuration.
 */
export interface DenyListPolicy {
  /** Policy version */
  version: string;
  /** Policy name */
  name: string;
  /** Policy description */
  description?: string;
  /** When this policy was created */
  createdAt: string;
  /** When this policy was last updated */
  updatedAt: string;
  /** Whether the policy is active */
  enabled: boolean;
  /** Default action for unmatched content */
  defaultAction: 'allow' | 'deny';
  /** Ordered list of rules */
  rules: DenyListRule[];
  /** Built-in rule sets to include */
  includes?: BuiltInRuleSet[];
}

/**
 * Built-in rule sets that can be included.
 */
export type BuiltInRuleSet =
  | 'pii-standard'      // Standard PII patterns
  | 'pii-strict'        // Strict PII (includes names, addresses)
  | 'secrets'           // API keys, passwords, tokens
  | 'financial'         // Credit cards, bank accounts
  | 'health'            // HIPAA-related
  | 'gdpr';             // GDPR-specific patterns

/**
 * Result of evaluating content against a deny-list policy.
 */
export interface DenyListEvaluation {
  /** Whether any rules matched */
  matched: boolean;
  /** The matching rules (if any) */
  matchedRules: Array<{
    rule: DenyListRule;
    matches: Array<{ start: number; end: number; content: string }>;
  }>;
  /** The final action to take */
  action: DenyListAction | 'allow';
  /** Evaluation timestamp */
  evaluatedAt: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

// ─── Field-Level Encryption ──────────────────────────────────

/**
 * Encrypted field wrapper.
 */
export interface EncryptedField {
  /** Marker to identify encrypted fields */
  __encrypted: true;
  /** Encryption algorithm used */
  algorithm: 'aes-256-gcm';
  /** Key derivation function */
  kdf: 'argon2id';
  /** Base64-encoded encrypted data (includes salt, IV, auth tag) */
  data: string;
  /** Field metadata (not encrypted) */
  meta?: {
    /** Original field type hint */
    type?: 'string' | 'object' | 'array';
    /** When the field was encrypted */
    encryptedAt: string;
    /** Key identifier (for key rotation) */
    keyId?: string;
  };
}

/**
 * Configuration for field-level encryption.
 */
export interface FieldEncryptionConfig {
  /** Fields to always encrypt (JSONPath patterns) */
  alwaysEncrypt: string[];
  /** Fields to encrypt if they contain PII */
  encryptIfPII: string[];
  /** Key identifier for rotation tracking */
  keyId: string;
  /** Encryption strength */
  strength: 'standard' | 'high';
}

// ─── Deletion Attestations ───────────────────────────────────

/**
 * Attestation of data that was excluded or deleted.
 */
export interface DeletionAttestation {
  /** Unique attestation ID */
  id: string;
  /** Attestation type */
  type: 'redaction' | 'denial' | 'expiration' | 'manual';
  /** When the deletion/exclusion occurred */
  timestamp: string;
  /** What was deleted (category, not content) */
  category: string;
  /** Hash of the original content (for verification) */
  contentHash: string;
  /** Size of deleted content in bytes */
  sizeBytes: number;
  /** Reason for deletion */
  reason: string;
  /** Rule or policy that triggered the deletion */
  triggeredBy?: {
    type: 'pii-rule' | 'deny-list' | 'retention' | 'user-request';
    ruleId?: string;
    ruleName?: string;
  };
  /** Cryptographic proof of deletion */
  proof: {
    /** Hash algorithm used */
    algorithm: 'sha256';
    /** Merkle root of deleted content (if multiple items) */
    merkleRoot?: string;
    /** Signature from the system (if attestation signing is enabled) */
    signature?: string;
  };
  /** Snapshot this attestation belongs to */
  snapshotId: string;
}

/**
 * Collection of deletion attestations for a snapshot.
 */
export interface DeletionAttestationLog {
  /** Log version */
  version: string;
  /** Associated snapshot ID */
  snapshotId: string;
  /** When the log was created */
  createdAt: string;
  /** Total number of attestations */
  count: number;
  /** Summary statistics */
  summary: {
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    totalBytesDeleted: number;
  };
  /** Individual attestations */
  attestations: DeletionAttestation[];
}

// ─── Privacy Pipeline Configuration ──────────────────────────

/**
 * Complete privacy controls configuration.
 */
export interface PrivacyConfig {
  /** Config version */
  version: string;
  /** Whether privacy controls are enabled */
  enabled: boolean;
  /** PII detection and redaction settings */
  pii: {
    /** Enable PII detection */
    enabled: boolean;
    /** PII types to detect */
    types: PIIType[];
    /** Redaction method */
    method: RedactionMethod;
    /** Minimum confidence threshold (0-1) */
    confidenceThreshold: number;
    /** Custom patterns to detect */
    customPatterns?: Array<{
      name: string;
      pattern: string;
      flags?: string;
    }>;
  };
  /** Deny-list policy */
  denyList: DenyListPolicy;
  /** Field-level encryption */
  fieldEncryption: FieldEncryptionConfig;
  /** Deletion attestation settings */
  attestations: {
    /** Enable deletion attestations */
    enabled: boolean;
    /** Sign attestations (requires signing key) */
    sign: boolean;
    /** Include in snapshot archive */
    includeInArchive: boolean;
  };
}

/**
 * Result of applying the full privacy pipeline to content.
 */
export interface PrivacyPipelineResult {
  /** Processed content */
  content: string;
  /** Whether any modifications were made */
  modified: boolean;
  /** PII detection/redaction results */
  pii?: PIIRedactionResult;
  /** Deny-list evaluation results */
  denyList?: DenyListEvaluation;
  /** Field encryption results */
  encryptedFields?: string[];
  /** Deletion attestations generated */
  attestations: DeletionAttestation[];
  /** Total processing time */
  processingTimeMs: number;
}
