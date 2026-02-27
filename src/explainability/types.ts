/**
 * Explainability Module Types
 *
 * Re-exports from main types plus module-specific types.
 */

export type {
  RetrievalExplanation,
  ScoreBreakdown,
  ScoreFactor,
  SourceTrace,
  PolicyPathEntry,
} from '../types.js';

/**
 * Options for generating retrieval explanations.
 */
export interface ExplainOptions {
  /** Query that triggered retrieval (for relevance scoring) */
  query?: string;
  /** Include full trace history */
  includeTraceHistory?: boolean;
  /** Output format */
  format?: 'json' | 'human' | 'markdown';
}

/**
 * Weights for different scoring factors.
 * Can be customized via configuration.
 */
export interface ScoringWeights {
  relevance: number;
  recency: number;
  tier: number;
  access: number;
  pinned: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  relevance: 0.4,
  recency: 0.25,
  tier: 0.15,
  access: 0.1,
  pinned: 0.1,
};

/**
 * Tier boost values (higher tier = higher boost).
 */
export const TIER_BOOSTS: Record<string, number> = {
  L1: 1.0,
  L2: 0.7,
  L3: 0.4,
};
