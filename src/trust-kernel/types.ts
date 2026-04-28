/**
 * Trust Kernel Types
 *
 * Issue #65: Staged Memory Promotion Engine (Trust Kernel)
 *
 * Defines trust states, decisions, and enforcement points for
 * gating memory promotion and action execution.
 */

// ─── Trust States ────────────────────────────────────────────

/**
 * Trust states for memory entries.
 *
 * State transitions:
 *   candidate ──▶ stable ──▶ (revoked to denylist)
 *       │            │
 *       ▼            ▼
 *   rejected    quarantined
 */
export type TrustState = 'candidate' | 'stable' | 'rejected' | 'quarantined' | 'revoked';

/**
 * Promotion scopes determine how memories can be used.
 */
export type PromotionScope = 'semantic' | 'procedural' | 'episodic';

/**
 * Trust enforcement modes for graduated rollout.
 */
export type TrustMode = 'shadow' | 'enforce_query' | 'enforce_action';

// ─── Trust Entry ─────────────────────────────────────────────

/**
 * A memory entry with trust metadata.
 */
export interface TrustEntry {
  /** Unique entry identifier */
  id: string;

  /** The memory content */
  content: string;

  /** Current trust state */
  state: TrustState;

  /** Promotion scope determines usage rules */
  scope: PromotionScope;

  /** Confidence score (0-1) */
  confidence: number;

  /** Source identifier for provenance */
  source: string;

  /** Creation timestamp */
  createdAt: string;

  /** Last state transition timestamp */
  stateChangedAt: string;

  /** Time-to-live in seconds (for episodic scope) */
  ttlSeconds?: number;

  /** Expiration timestamp (computed from ttl) */
  expiresAt?: string;

  /** Tags for categorization */
  tags?: string[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ─── Trust Decision ──────────────────────────────────────────

/**
 * Trust decision returned by gates.
 */
export interface TrustDecision {
  /** Whether to allow the trusted answer */
  allowTrustedAnswer: boolean;

  /** Whether to allow the trusted action */
  allowTrustedAction: boolean;

  /** Current enforcement mode */
  trustMode: TrustMode;

  /** Reasons preventing trust (if blocked) */
  blockers: string[];

  /** Audit reason codes */
  reasonCodes: string[];

  /** Hash of the state envelope for integrity */
  stateEnvelopeHash: string;

  /** Compatibility level of the envelope */
  envelopeCompatLevel: number;

  /** Current denylist epoch version */
  denylistEpoch: number;

  /** Timestamp of the decision */
  timestamp: string;
}

// ─── Side Effect Registry ────────────────────────────────────

/**
 * Effect types for side effect classification.
 */
export type EffectType = 'read_pure' | 'read_risky' | 'external_call' | 'state_mutation';

/**
 * Required trust level for effect execution.
 */
export type RequiredTrustLevel = 'any' | 'stable_facts' | 'high_confidence';

/**
 * Audit level for effect logging.
 */
export type AuditLevel = 'none' | 'log' | 'review';

/**
 * Registration entry for a side effect.
 */
export interface SideEffectRegistration {
  /** Effect type classification */
  effectType: EffectType;

  /** Tool or function name */
  toolName: string;

  /** Minimum trust level required */
  requiredTrustLevel: RequiredTrustLevel;

  /** Whether explicit user authorization is required */
  requiresExplicitAuth: boolean;

  /** Audit logging level */
  auditLevel: AuditLevel;

  /** Human-readable description */
  description?: string;
}

// ─── Transition Events ───────────────────────────────────────

/**
 * State transition event for audit trail.
 */
export interface TransitionEvent {
  /** Event identifier */
  id: string;

  /** Entry that transitioned */
  entryId: string;

  /** Previous state */
  fromState: TrustState;

  /** New state */
  toState: TrustState;

  /** Reason for transition */
  reason: string;

  /** Actor that triggered the transition */
  actor: string;

  /** Timestamp of transition */
  timestamp: string;

  /** Additional context */
  metadata?: Record<string, unknown>;
}

// ─── Promotion Rules ─────────────────────────────────────────

/**
 * Rule for automatic promotion evaluation.
 */
export interface PromotionRule {
  /** Rule identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Scope this rule applies to */
  scope: PromotionScope;

  /** Minimum confidence for promotion */
  minConfidence: number;

  /** Minimum age in seconds before promotion */
  minAgeSeconds: number;

  /** Required tags (all must be present) */
  requiredTags?: string[];

  /** Forbidden tags (none must be present) */
  forbiddenTags?: string[];

  /** Whether this rule is active */
  enabled: boolean;
}

// ─── Gate Results ────────────────────────────────────────────

/**
 * Result from WriteGate evaluation.
 */
export interface WriteGateResult {
  /** Whether the write is allowed */
  allowed: boolean;

  /** Assigned trust state for the entry */
  assignedState: TrustState;

  /** Assigned scope for the entry */
  assignedScope: PromotionScope;

  /** Initial confidence score */
  confidence: number;

  /** Reasons if blocked */
  blockers: string[];

  /** Processing latency in milliseconds */
  latencyMs: number;
}

/**
 * Result from TrustGate (query path) evaluation.
 */
export interface TrustGateResult {
  /** Entries that passed trust evaluation */
  trustedEntries: TrustEntry[];

  /** Entries that were filtered out */
  filteredEntries: TrustEntry[];

  /** Trust decision for this query */
  decision: TrustDecision;

  /** Processing latency in milliseconds */
  latencyMs: number;
}

/**
 * Result from ActionGate evaluation.
 */
export interface ActionGateResult {
  /** Whether the action is allowed */
  allowed: boolean;

  /** The side effect registration if found */
  registration?: SideEffectRegistration;

  /** Trust decision for this action */
  decision: TrustDecision;

  /** Reasons if blocked */
  blockers: string[];

  /** Processing latency in milliseconds */
  latencyMs: number;
}

// ─── Restore Status ──────────────────────────────────────────

/**
 * Trust status for restore operations.
 */
export type RestoreTrustStatus = 'trusted' | 'restricted' | 'blocked';

/**
 * Restore result with trust information.
 */
export interface TrustRestoreResult {
  /** Overall trust status */
  status: RestoreTrustStatus;

  /** Allowed actions in this trust context */
  allowedActions: string[];

  /** Blocked actions in this trust context */
  blockedActions: string[];

  /** Compatibility level achieved */
  compatLevel: number;

  /** Warnings about trust state */
  warnings: string[];
}

// ─── Metrics ─────────────────────────────────────────────────

/**
 * Trust system metrics for monitoring.
 */
export interface TrustMetrics {
  /** Total entries by state */
  entriesByState: Record<TrustState, number>;

  /** Total entries by scope */
  entriesByScope: Record<PromotionScope, number>;

  /** Promotions in the last hour */
  promotionsLastHour: number;

  /** Rejections in the last hour */
  rejectionsLastHour: number;

  /** Average promotion latency (ms) */
  avgPromotionLatencyMs: number;

  /** Write gate p95 latency (ms) */
  writeGateP95Ms: number;

  /** Action gate p95 latency (ms) */
  actionGateP95Ms: number;

  /** Current denylist size */
  denylistSize: number;

  /** Critical invariant breaches (should be 0) */
  criticalBreaches: number;
}
