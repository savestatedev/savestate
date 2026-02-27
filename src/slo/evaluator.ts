/**
 * SLO Evaluator
 *
 * Evaluates memory freshness SLOs and generates compliance reports.
 * Implements Issue #108.
 */

import {
  SLOConfig,
  SLOComplianceStatus,
  SLOViolation,
  SLOReport,
  RecallFailure,
  DriftMetrics,
  DriftThresholds,
  DEFAULT_DRIFT_THRESHOLDS,
  createEmptySLOReport,
  computeStalenessMetrics,
} from './types.js';
import type { Namespace, MemoryObject, MemoryResult } from '../checkpoint/types.js';
import { namespaceKey } from '../checkpoint/types.js';

// ─── Session History ─────────────────────────────────────────

/**
 * Session history entry for cross-session tracking.
 */
export interface SessionHistoryEntry {
  session_id: string;
  namespace_key: string;
  started_at: string;
  ended_at?: string;
  memory_ids: string[];
  parent_session_id?: string;
}

/**
 * In-memory session history store (would be persisted in production).
 */
const sessionHistory: Map<string, SessionHistoryEntry[]> = new Map();

/**
 * Record a new session.
 */
export function recordSession(entry: SessionHistoryEntry): void {
  const existing = sessionHistory.get(entry.namespace_key) ?? [];
  existing.push(entry);
  sessionHistory.set(entry.namespace_key, existing);
}

/**
 * Get session history for a namespace.
 */
export function getSessionHistory(namespaceKey: string): SessionHistoryEntry[] {
  return sessionHistory.get(namespaceKey) ?? [];
}

/**
 * List memories grouped by session.
 */
export function sessionHistoryByNamespace(
  namespaceKey: string,
): SessionHistoryEntry[] {
  return getSessionHistory(namespaceKey);
}

// ─── Drift Detection ─────────────────────────────────────────

/**
 * Calculate drift score for a session based on memory coherence.
 * Uses topic clustering and temporal patterns.
 */
export function calculateDriftScore(
  memories: MemoryObject[],
  thresholds: DriftThresholds = DEFAULT_DRIFT_THRESHOLDS,
): DriftMetrics {
  if (memories.length === 0) {
    return {
      drift_score: 0,
      drift_detected: false,
      topic_changes: 0,
      coherence_score: 1,
      fragmentation_score: 0,
      last_checked_at: new Date().toISOString(),
    };
  }

  // Sort memories by creation time
  const sorted = [...memories].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  // Calculate topic changes based on tag differences
  let topicChanges = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevTags = new Set(sorted[i - 1].tags);
    const currTags = new Set(sorted[i].tags);
    const intersection = [...currTags].filter((t) => prevTags.has(t));
    const union = new Set([...prevTags, ...currTags]);

    // Jaccard distance - if tags are very different, count as topic change
    const similarity = union.size > 0 ? intersection.length / union.size : 1;
    if (similarity < 0.3) {
      topicChanges++;
    }
  }

  // Calculate fragmentation (memories with no shared tags)
  let isolatedCount = 0;
  for (const mem of memories) {
    const hasSharedTags = memories.some(
      (other) =>
        other.memory_id !== mem.memory_id &&
        other.tags.some((t) => mem.tags.includes(t)),
    );
    if (!hasSharedTags && mem.tags.length > 0) {
      isolatedCount++;
    }
  }
  const fragmentationScore = memories.length > 1 ? isolatedCount / memories.length : 0;

  // Calculate coherence based on tag overlap across all memories
  const allTags = new Map<string, number>();
  for (const mem of memories) {
    for (const tag of mem.tags) {
      allTags.set(tag, (allTags.get(tag) ?? 0) + 1);
    }
  }
  const avgTagFrequency =
    allTags.size > 0
      ? Array.from(allTags.values()).reduce((a, b) => a + b, 0) / allTags.size / memories.length
      : 0;
  const coherenceScore = Math.min(1, avgTagFrequency * 2);

  // Compute drift score
  const topicChangeRate = sorted.length > 1 ? topicChanges / (sorted.length - 1) : 0;
  const driftScore = Math.min(
    1,
    topicChangeRate * 0.4 + fragmentationScore * 0.3 + (1 - coherenceScore) * 0.3,
  );

  const driftDetected =
    driftScore > thresholds.max_drift_score ||
    coherenceScore < thresholds.min_coherence_score ||
    fragmentationScore > thresholds.max_fragmentation_score;

  return {
    drift_score: driftScore,
    drift_detected: driftDetected,
    topic_changes: topicChanges,
    coherence_score: coherenceScore,
    fragmentation_score: fragmentationScore,
    last_checked_at: new Date().toISOString(),
  };
}

/**
 * Get drift score for a session.
 */
export function driftScore(
  sessionId: string,
  memories: MemoryObject[],
  thresholds?: DriftThresholds,
): DriftMetrics {
  // Filter memories by session if session_id is tracked in metadata
  const sessionMemories = memories.filter(
    (m) => (m as MemoryObjectWithSession).session_id === sessionId,
  );
  return calculateDriftScore(sessionMemories.length > 0 ? sessionMemories : memories, thresholds);
}

// Extended memory type with session tracking
interface MemoryObjectWithSession extends MemoryObject {
  session_id?: string;
}

// ─── SLO Evaluation ──────────────────────────────────────────

/**
 * Evaluate SLO compliance for a set of memory results.
 */
export function evaluateFreshness(
  results: MemoryResult[],
  config: SLOConfig,
): {
  compliant: number;
  total: number;
  avgStaleness: number;
  violations: SLOViolation[];
} {
  if (results.length === 0) {
    return { compliant: 0, total: 0, avgStaleness: 0, violations: [] };
  }

  let compliant = 0;
  let totalStaleness = 0;
  const violations: SLOViolation[] = [];

  const maxAgeHours = config.freshness.max_age_hours;

  for (const result of results) {
    const ageHours = (result.age_days ?? 0) * 24;
    const stalenessScore = result.staleness_score ?? (ageHours / maxAgeHours);
    totalStaleness += Math.min(1, stalenessScore);

    if (!result.is_stale && stalenessScore < 1) {
      compliant++;
    }
  }

  const compliancePercent = (compliant / results.length) * 100;
  if (compliancePercent < config.freshness.recall_target_percent) {
    violations.push({
      slo_type: 'freshness',
      actual_value: compliancePercent,
      required_value: config.freshness.recall_target_percent,
      severity: compliancePercent < config.freshness.recall_target_percent * 0.8 ? 'critical' : 'warning',
      description: `Freshness compliance at ${compliancePercent.toFixed(1)}%, target is ${config.freshness.recall_target_percent}%`,
    });
  }

  return {
    compliant,
    total: results.length,
    avgStaleness: totalStaleness / results.length,
    violations,
  };
}

/**
 * Evaluate relevance compliance.
 */
export function evaluateRelevance(
  results: MemoryResult[],
  config: SLOConfig,
): {
  compliant: number;
  total: number;
  violations: SLOViolation[];
} {
  if (results.length === 0) {
    return { compliant: 0, total: 0, violations: [] };
  }

  const threshold = config.freshness.relevance_threshold;
  let compliant = 0;
  const violations: SLOViolation[] = [];

  for (const result of results) {
    const similarity = result.score_components.semantic_similarity;
    if (similarity >= threshold) {
      compliant++;
    }
  }

  const compliancePercent = (compliant / results.length) * 100;
  if (compliancePercent < config.freshness.recall_target_percent) {
    violations.push({
      slo_type: 'relevance',
      actual_value: compliancePercent,
      required_value: config.freshness.recall_target_percent,
      severity: compliancePercent < config.freshness.recall_target_percent * 0.8 ? 'critical' : 'warning',
      description: `Relevance compliance at ${compliancePercent.toFixed(1)}%, target is ${config.freshness.recall_target_percent}%`,
    });
  }

  return { compliant, total: results.length, violations };
}

/**
 * Generate full SLO compliance status for a namespace.
 */
export function evaluateNamespaceCompliance(
  namespace: Namespace,
  results: MemoryResult[],
  failures: RecallFailure[],
  crossSessionAttempts: number,
  crossSessionSuccesses: number,
  config: SLOConfig,
): SLOComplianceStatus {
  const freshnessEval = evaluateFreshness(results, config);
  const relevanceEval = evaluateRelevance(results, config);

  const violations: SLOViolation[] = [
    ...freshnessEval.violations,
    ...relevanceEval.violations,
  ];

  // Check recall target
  const recallRate = results.length > 0 ? 100 : 0; // Simplified - actual would track queries
  if (recallRate < config.freshness.recall_target_percent) {
    violations.push({
      slo_type: 'recall',
      actual_value: recallRate,
      required_value: config.freshness.recall_target_percent,
      severity: 'warning',
      description: `Recall rate at ${recallRate.toFixed(1)}%, target is ${config.freshness.recall_target_percent}%`,
    });
  }

  // Check cross-session success rate
  const crossSessionRate = crossSessionAttempts > 0
    ? (crossSessionSuccesses / crossSessionAttempts) * 100
    : 100;
  if (crossSessionRate < 90) {
    violations.push({
      slo_type: 'cross_session',
      actual_value: crossSessionRate,
      required_value: 90,
      severity: crossSessionRate < 70 ? 'critical' : 'warning',
      description: `Cross-session recall at ${crossSessionRate.toFixed(1)}%, target is 90%`,
    });
  }

  const freshnessPercent = results.length > 0 ? (freshnessEval.compliant / results.length) * 100 : 100;
  const relevancePercent = results.length > 0 ? (relevanceEval.compliant / results.length) * 100 : 100;

  return {
    namespace_key: namespaceKey(namespace),
    is_compliant: violations.length === 0,
    freshness_compliance_percent: freshnessPercent,
    relevance_compliance_percent: relevancePercent,
    recall_compliance_percent: recallRate,
    cross_session_success_percent: crossSessionRate,
    failure_count: failures.length,
    evaluated_at: new Date().toISOString(),
    slo_config: config,
    violations,
  };
}

// ─── SLO Reporting ───────────────────────────────────────────

/**
 * Aggregate recall failures into a report.
 */
export function aggregateFailures(
  failures: RecallFailure[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const failure of failures) {
    counts[failure.reason] = (counts[failure.reason] ?? 0) + 1;
  }
  return counts;
}

/**
 * Generate a weekly SLO report.
 */
export function generateSLOReport(
  periodStart: string,
  periodEnd: string,
  queryResults: MemoryResult[][],
  failures: RecallFailure[],
  crossSessionAttempts: number,
  crossSessionSuccesses: number,
  namespaceCompliance: SLOComplianceStatus[],
  avgDriftScore?: number,
): SLOReport {
  const report = createEmptySLOReport(periodStart, periodEnd);

  // Aggregate query results
  let totalStaleness = 0;
  let resultCount = 0;

  for (const results of queryResults) {
    report.total_queries++;
    let hasFresh = false;
    let hasRelevant = false;
    let hasSuccess = results.length > 0;

    for (const result of results) {
      resultCount++;
      totalStaleness += result.staleness_score ?? 0;

      if (!result.is_stale) hasFresh = true;
      if (result.score_components.semantic_similarity >= 0.3) hasRelevant = true;
    }

    if (hasFresh) report.fresh_queries++;
    if (hasRelevant) report.relevant_queries++;
    if (hasSuccess) report.successful_recalls++;
  }

  report.cross_session_attempts = crossSessionAttempts;
  report.cross_session_successes = crossSessionSuccesses;
  report.total_failures = failures.length;
  report.failures_by_reason = aggregateFailures(failures) as SLOReport['failures_by_reason'];
  report.avg_staleness_score = resultCount > 0 ? totalStaleness / resultCount : 0;
  report.avg_drift_score = avgDriftScore;
  report.namespace_compliance = namespaceCompliance;

  return report;
}

/**
 * Format SLO report as a human-readable summary.
 */
export function formatSLOReport(report: SLOReport): string {
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║                    SLO COMPLIANCE REPORT                     ║');
  lines.push('╠══════════════════════════════════════════════════════════════╣');
  lines.push(`║ Period: ${report.period_start.slice(0, 10)} to ${report.period_end.slice(0, 10)}             ║`);
  lines.push('╠══════════════════════════════════════════════════════════════╣');

  // Summary metrics
  const freshPercent = report.total_queries > 0
    ? ((report.fresh_queries / report.total_queries) * 100).toFixed(1)
    : '100.0';
  const relevantPercent = report.total_queries > 0
    ? ((report.relevant_queries / report.total_queries) * 100).toFixed(1)
    : '100.0';
  const recallPercent = report.total_queries > 0
    ? ((report.successful_recalls / report.total_queries) * 100).toFixed(1)
    : '100.0';
  const crossSessionPercent = report.cross_session_attempts > 0
    ? ((report.cross_session_successes / report.cross_session_attempts) * 100).toFixed(1)
    : '100.0';

  lines.push(`║ Total Queries:        ${String(report.total_queries).padStart(8)}                       ║`);
  lines.push(`║ Freshness Rate:       ${freshPercent.padStart(7)}%                       ║`);
  lines.push(`║ Relevance Rate:       ${relevantPercent.padStart(7)}%                       ║`);
  lines.push(`║ Recall Success:       ${recallPercent.padStart(7)}%                       ║`);
  lines.push(`║ Cross-Session:        ${crossSessionPercent.padStart(7)}%                       ║`);
  lines.push(`║ Avg Staleness:        ${report.avg_staleness_score.toFixed(3).padStart(8)}                       ║`);
  if (report.avg_drift_score !== undefined) {
    lines.push(`║ Avg Drift:            ${report.avg_drift_score.toFixed(3).padStart(8)}                       ║`);
  }
  lines.push('╠══════════════════════════════════════════════════════════════╣');

  // Failures
  if (report.total_failures > 0) {
    lines.push(`║ FAILURES: ${report.total_failures}                                              ║`);
    for (const [reason, count] of Object.entries(report.failures_by_reason)) {
      if (count > 0) {
        lines.push(`║   ${reason.padEnd(30)} ${String(count).padStart(5)}                ║`);
      }
    }
    lines.push('╠══════════════════════════════════════════════════════════════╣');
  }

  // Namespace compliance
  if (report.namespace_compliance.length > 0) {
    lines.push('║ NAMESPACE COMPLIANCE                                         ║');
    for (const ns of report.namespace_compliance) {
      const status = ns.is_compliant ? '✓' : '✗';
      lines.push(`║ ${status} ${ns.namespace_key.slice(0, 40).padEnd(40)} ${ns.freshness_compliance_percent.toFixed(0).padStart(3)}% fresh ║`);
      for (const violation of ns.violations) {
        lines.push(`║   └─ [${violation.severity.toUpperCase()}] ${violation.description.slice(0, 45)} ║`);
      }
    }
  }

  lines.push('╚══════════════════════════════════════════════════════════════╝');

  return lines.join('\n');
}
