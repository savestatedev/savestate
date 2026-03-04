/**
 * Memory Freshness SLO Types
 *
 * Defines Service Level Objectives for memory freshness, cross-session recall,
 * and coherence monitoring. Implements Issue #108.
 *
 * @see https://github.com/savestatedev/savestate/issues/108
 */

// ─── Freshness SLO ───────────────────────────────────────────

/**
 * Service Level Objective for memory freshness.
 * Defines thresholds for what constitutes acceptable memory quality.
 */
export interface FreshnessSLO {
  /** Maximum age in hours before a memory is considered stale */
  max_age_hours: number;
  /** Minimum relevance score (0-1) for a memory to be considered valid */
  relevance_threshold: number;
  /** Target percentage of queries that should return fresh, relevant memories */
  recall_target_percent: number;
}

/**
 * Default freshness SLO values.
 */
export const DEFAULT_FRESHNESS_SLO: FreshnessSLO = {
  max_age_hours: 2160, // 90 days
  relevance_threshold: 0.3,
  recall_target_percent: 95,
};

// ─── SLO Configuration ───────────────────────────────────────

/**
 * Full SLO configuration for a namespace.
 */
export interface SLOConfig {
  /** Freshness SLO settings */
  freshness: FreshnessSLO;
  /** Whether SLO monitoring is enabled */
  enabled: boolean;
  /** Alert when SLO violations exceed this percentage */
  alert_threshold_percent: number;
  /** How often to compute SLO metrics (in minutes) */
  evaluation_interval_minutes: number;
}

/**
 * Default SLO configuration.
 */
export const DEFAULT_SLO_CONFIG: SLOConfig = {
  freshness: DEFAULT_FRESHNESS_SLO,
  enabled: true,
  alert_threshold_percent: 10,
  evaluation_interval_minutes: 60,
};

// ─── Staleness Metrics ───────────────────────────────────────

/**
 * Staleness score breakdown for a memory result.
 */
export interface StalenessMetrics {
  /** Staleness score (0-1, higher = more stale) */
  staleness_score: number;
  /** Whether the memory is stale according to the configured SLO */
  is_stale: boolean;
  /** Age of the memory in days */
  age_days: number;
  /** Age of the memory in hours */
  age_hours: number;
  /** Human-readable reason if stale */
  stale_reason?: string;
  /** Time until memory becomes stale (negative if already stale) */
  time_until_stale_hours?: number;
}

/**
 * Calculate staleness score based on age and SLO.
 * Returns 0 for very fresh memories, 1 for very stale.
 */
export function calculateStalenessScore(
  ageHours: number,
  slo: FreshnessSLO = DEFAULT_FRESHNESS_SLO,
): number {
  if (ageHours <= 0) return 0;
  if (ageHours >= slo.max_age_hours) return 1;

  // Linear decay from 0 to 1 as age approaches max_age_hours
  // With a "grace period" at 50% of max age where staleness starts to increase
  const gracePeriod = slo.max_age_hours * 0.5;
  if (ageHours <= gracePeriod) {
    // Very low staleness in grace period
    return (ageHours / gracePeriod) * 0.2;
  }

  // Accelerating staleness after grace period
  const remaining = slo.max_age_hours - gracePeriod;
  const overtime = ageHours - gracePeriod;
  return 0.2 + (overtime / remaining) * 0.8;
}

/**
 * Compute full staleness metrics for a memory.
 */
export function computeStalenessMetrics(
  createdAt: string,
  lastAccessedAt: string | undefined,
  slo: FreshnessSLO = DEFAULT_FRESHNESS_SLO,
): StalenessMetrics {
  const now = Date.now();
  const createdTime = new Date(createdAt).getTime();
  const accessedTime = lastAccessedAt ? new Date(lastAccessedAt).getTime() : NaN;

  // Use most recent timestamp
  const effectiveTime = Number.isFinite(accessedTime)
    ? Math.max(createdTime, accessedTime)
    : createdTime;

  const ageMs = now - effectiveTime;
  const ageHours = ageMs / (1000 * 60 * 60);
  const ageDays = ageHours / 24;

  const stalenessScore = calculateStalenessScore(ageHours, slo);
  const isStale = ageHours >= slo.max_age_hours;
  const timeUntilStale = slo.max_age_hours - ageHours;

  return {
    staleness_score: stalenessScore,
    is_stale: isStale,
    age_days: ageDays,
    age_hours: ageHours,
    stale_reason: isStale
      ? `Memory is ${Math.floor(ageDays)} days old (SLO: ${Math.floor(slo.max_age_hours / 24)} days)`
      : undefined,
    time_until_stale_hours: timeUntilStale,
  };
}

// ─── Cross-Session Tracking ──────────────────────────────────

/**
 * Session metadata for cross-session memory tracking.
 */
export interface SessionInfo {
  /** Unique session identifier */
  session_id: string;
  /** ISO 8601 timestamp when session started */
  started_at: string;
  /** ISO 8601 timestamp when session ended (null if active) */
  ended_at?: string;
  /** Number of memories created in this session */
  memory_count: number;
  /** Parent session ID (for resumed sessions) */
  parent_session_id?: string;
}

/**
 * Memory provenance tracking across sessions.
 */
export interface SessionProvenance {
  /** Session where memory was created */
  origin_session_id: string;
  /** Sessions where memory was accessed */
  accessed_in_sessions: string[];
  /** Sessions where memory was modified */
  modified_in_sessions: string[];
  /** Cross-session recall count */
  cross_session_recalls: number;
}

// ─── Drift Detection ─────────────────────────────────────────

/**
 * Coherence metrics for drift detection in long sessions.
 */
export interface DriftMetrics {
  /** Overall drift score (0-1, higher = more drift) */
  drift_score: number;
  /** Whether drift exceeds acceptable threshold */
  drift_detected: boolean;
  /** Number of topic changes detected */
  topic_changes: number;
  /** Semantic coherence score (0-1, higher = more coherent) */
  coherence_score: number;
  /** Memory fragmentation (ratio of isolated memories) */
  fragmentation_score: number;
  /** ISO 8601 timestamp of last coherence check */
  last_checked_at: string;
}

/**
 * Drift detection thresholds.
 */
export interface DriftThresholds {
  /** Maximum acceptable drift score */
  max_drift_score: number;
  /** Minimum acceptable coherence */
  min_coherence_score: number;
  /** Maximum acceptable fragmentation */
  max_fragmentation_score: number;
}

export const DEFAULT_DRIFT_THRESHOLDS: DriftThresholds = {
  max_drift_score: 0.4,
  min_coherence_score: 0.6,
  max_fragmentation_score: 0.3,
};

// ─── Recall Failures ─────────────────────────────────────────

/**
 * Reason codes for recall failures.
 */
export type RecallFailureReason =
  | 'no_matches'
  | 'all_stale'
  | 'below_relevance_threshold'
  | 'cross_session_unavailable'
  | 'storage_error'
  | 'timeout'
  | 'embedding_unavailable'
  | 'namespace_not_found'
  | 'quota_exceeded';

/**
 * A recall failure with context for debugging.
 */
export interface RecallFailure {
  /** Unique identifier for this failure */
  failure_id: string;
  /** Why the recall failed */
  reason: RecallFailureReason;
  /** Human-readable description */
  message: string;
  /** Original query that caused the failure */
  query?: string;
  /** Namespace where recall was attempted */
  namespace_key?: string;
  /** Session ID where failure occurred */
  session_id?: string;
  /** ISO 8601 timestamp of failure */
  timestamp: string;
  /** Number of candidate memories that were filtered out */
  filtered_count?: number;
  /** Suggested actions to resolve */
  suggestions?: string[];
  /** Whether this failure was surfaced to the user */
  surfaced: boolean;
}

/**
 * Create a new recall failure.
 */
export function createRecallFailure(
  reason: RecallFailureReason,
  context: {
    query?: string;
    namespaceKey?: string;
    sessionId?: string;
    filteredCount?: number;
  } = {},
): RecallFailure {
  const messages: Record<RecallFailureReason, string> = {
    no_matches: 'No memories matched the query',
    all_stale: 'All matching memories are stale (exceeded freshness SLO)',
    below_relevance_threshold: 'No memories met the relevance threshold',
    cross_session_unavailable: 'Cross-session memories could not be retrieved',
    storage_error: 'Storage backend returned an error',
    timeout: 'Memory retrieval timed out',
    embedding_unavailable: 'Vector embeddings are not available for semantic search',
    namespace_not_found: 'The specified namespace does not exist',
    quota_exceeded: 'Memory quota has been exceeded',
  };

  const suggestions: Record<RecallFailureReason, string[]> = {
    no_matches: ['Try a broader query', 'Check if memories exist in this namespace'],
    all_stale: ['Refresh memories with updated content', 'Increase freshness SLO max_age_hours'],
    below_relevance_threshold: ['Lower the relevance threshold', 'Add more specific tags to memories'],
    cross_session_unavailable: ['Ensure cross-session tracking is enabled', 'Check session history'],
    storage_error: ['Check storage backend connectivity', 'Review error logs'],
    timeout: ['Reduce query scope', 'Check system load'],
    embedding_unavailable: ['Enable vector embeddings', 'Use tag-based search instead'],
    namespace_not_found: ['Verify namespace configuration', 'Initialize the namespace'],
    quota_exceeded: ['Delete old memories', 'Upgrade storage quota'],
  };

  return {
    failure_id: `rf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    reason,
    message: messages[reason],
    query: context.query,
    namespace_key: context.namespaceKey,
    session_id: context.sessionId,
    timestamp: new Date().toISOString(),
    filtered_count: context.filteredCount,
    suggestions: suggestions[reason],
    surfaced: false,
  };
}

// ─── SLO Compliance ──────────────────────────────────────────

/**
 * SLO compliance status for a namespace.
 */
export interface SLOComplianceStatus {
  /** Namespace key */
  namespace_key: string;
  /** Whether currently compliant with all SLOs */
  is_compliant: boolean;
  /** Freshness compliance percentage */
  freshness_compliance_percent: number;
  /** Relevance compliance percentage */
  relevance_compliance_percent: number;
  /** Recall target compliance percentage */
  recall_compliance_percent: number;
  /** Cross-session recall success rate */
  cross_session_success_percent: number;
  /** Number of recall failures in evaluation period */
  failure_count: number;
  /** ISO 8601 timestamp of last evaluation */
  evaluated_at: string;
  /** SLO configuration used for evaluation */
  slo_config: SLOConfig;
  /** Detailed violations if any */
  violations: SLOViolation[];
}

/**
 * A specific SLO violation.
 */
export interface SLOViolation {
  /** Type of SLO violated */
  slo_type: 'freshness' | 'relevance' | 'recall' | 'cross_session';
  /** Current value */
  actual_value: number;
  /** Required value per SLO */
  required_value: number;
  /** Severity of violation */
  severity: 'warning' | 'critical';
  /** Human-readable description */
  description: string;
}

// ─── SLO Report ──────────────────────────────────────────────

/**
 * Weekly SLO summary report.
 */
export interface SLOReport {
  /** Report identifier */
  report_id: string;
  /** Start of reporting period */
  period_start: string;
  /** End of reporting period */
  period_end: string;
  /** Total queries evaluated */
  total_queries: number;
  /** Queries meeting freshness SLO */
  fresh_queries: number;
  /** Queries meeting relevance SLO */
  relevant_queries: number;
  /** Queries with successful recall */
  successful_recalls: number;
  /** Cross-session recall attempts */
  cross_session_attempts: number;
  /** Successful cross-session recalls */
  cross_session_successes: number;
  /** Total recall failures */
  total_failures: number;
  /** Failures by reason */
  failures_by_reason: Record<RecallFailureReason, number>;
  /** Average staleness score */
  avg_staleness_score: number;
  /** Average drift score (if drift detection enabled) */
  avg_drift_score?: number;
  /** Per-namespace compliance */
  namespace_compliance: SLOComplianceStatus[];
  /** Generated at timestamp */
  generated_at: string;
}

/**
 * Create an empty SLO report for a period.
 */
export function createEmptySLOReport(periodStart: string, periodEnd: string): SLOReport {
  return {
    report_id: `slo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    period_start: periodStart,
    period_end: periodEnd,
    total_queries: 0,
    fresh_queries: 0,
    relevant_queries: 0,
    successful_recalls: 0,
    cross_session_attempts: 0,
    cross_session_successes: 0,
    total_failures: 0,
    failures_by_reason: {
      no_matches: 0,
      all_stale: 0,
      below_relevance_threshold: 0,
      cross_session_unavailable: 0,
      storage_error: 0,
      timeout: 0,
      embedding_unavailable: 0,
      namespace_not_found: 0,
      quota_exceeded: 0,
    },
    avg_staleness_score: 0,
    namespace_compliance: [],
    generated_at: new Date().toISOString(),
  };
}
