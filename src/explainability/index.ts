/**
 * SaveState Retrieval Explainability Module
 *
 * Provides transparency into memory retrieval decisions.
 * Addresses "black box retrieval" concerns for production users.
 */

export {
  explainMemory,
  calculateScoreBreakdown,
  calculateCompositeScore,
  buildSourceTrace,
  buildPolicyPath,
  generateSummary,
  formatExplanationHuman,
  formatExplanationMarkdown,
} from './explain.js';

export {
  DEFAULT_SCORING_WEIGHTS,
  TIER_BOOSTS,
  type ExplainOptions,
  type ScoringWeights,
} from './types.js';

export type {
  RetrievalExplanation,
  ScoreBreakdown,
  ScoreFactor,
  SourceTrace,
  PolicyPathEntry,
} from '../types.js';
