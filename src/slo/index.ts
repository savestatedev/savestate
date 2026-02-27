/**
 * SLO Module Exports
 *
 * Memory Freshness SLOs and cross-session recall reliability.
 * Implements Issue #108.
 */

// Types
export {
  FreshnessSLO,
  DEFAULT_FRESHNESS_SLO,
  SLOConfig,
  DEFAULT_SLO_CONFIG,
  StalenessMetrics,
  calculateStalenessScore,
  computeStalenessMetrics,
  SessionInfo,
  SessionProvenance,
  DriftMetrics,
  DriftThresholds,
  DEFAULT_DRIFT_THRESHOLDS,
  RecallFailureReason,
  RecallFailure,
  createRecallFailure,
  SLOComplianceStatus,
  SLOViolation,
  SLOReport,
  createEmptySLOReport,
} from './types.js';

// Configuration
export {
  loadSLOConfig,
  saveSLOConfig,
  mergeSLOConfig,
  mergeFreshnessSLO,
  validateSLOConfig,
  getSLOConfigValue,
  setSLOConfigValue,
  formatDuration,
  parseDuration,
} from './config.js';

// Evaluation
export {
  SessionHistoryEntry,
  recordSession,
  getSessionHistory,
  sessionHistoryByNamespace,
  calculateDriftScore,
  driftScore,
  evaluateFreshness,
  evaluateRelevance,
  evaluateNamespaceCompliance,
  aggregateFailures,
  generateSLOReport,
  formatSLOReport,
} from './evaluator.js';
