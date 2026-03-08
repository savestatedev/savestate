/**
 * Policy-Governed Working-Set Bid Market - Types
 * Issue #72: Turn memory from storage into a decision layer
 *
 * Every turn, select the highest-value context under strict token/latency
 * budgets with explicit safety constraints.
 */

/**
 * Memory type classification for scoring weights
 */
export type BidMemoryType =
  | 'goal'           // Current objective
  | 'constraint'     // User/policy/system constraints
  | 'fact'           // Established facts
  | 'recent_state'   // Recent context state
  | 'decision'       // Past decisions
  | 'event'          // Historical events
  | 'preference'     // User preferences
  | 'conversation';  // Conversation history

/**
 * Extended candidate schema per Issue #72 spec
 */
export interface BidCandidate {
  id: string;
  memory_type: BidMemoryType;
  content: string;
  token_cost: number;
  
  // Core scoring attributes (0-1 scale)
  relevance: number;       // Semantic relevance to current task
  certainty: number;       // Confidence in this memory's accuracy
  source_quality: number;  // Trustworthiness of the source
  freshness: number;       // Temporal relevance (exponential decay)
  novelty: number;         // Information not redundant with others
  conflict_risk: number;   // Risk of contradiction with other memories
  
  // Metadata
  created_at: string;
  updated_at?: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Per-memory-type weight for scoring
 */
export const MEMORY_TYPE_WEIGHTS: Record<BidMemoryType, number> = {
  goal: 0.25,           // High weight - always important
  constraint: 0.20,     // High weight - must respect
  fact: 0.15,           // Medium weight
  recent_state: 0.15,   // Medium weight
  decision: 0.10,       // Lower weight
  event: 0.08,          // Lower weight
  preference: 0.05,     // Low weight
  conversation: 0.02,   // Lowest weight
};

/**
 * Scoring weights configuration
 * Formula: score = w_type + 0.30*relevance + 0.20*certainty + 0.15*source_quality
 *          + 0.15*freshness + 0.10*novelty - 0.20*conflict_risk
 */
export interface BidScoringWeights {
  relevance: number;
  certainty: number;
  source_quality: number;
  freshness: number;
  novelty: number;
  conflict_risk: number;  // Applied as negative
}

export const DEFAULT_BID_SCORING_WEIGHTS: BidScoringWeights = {
  relevance: 0.30,
  certainty: 0.20,
  source_quality: 0.15,
  freshness: 0.15,
  novelty: 0.10,
  conflict_risk: 0.20,  // Subtracted from score
};

/**
 * Scored candidate with breakdown
 */
export interface ScoredBidCandidate extends BidCandidate {
  score: number;
  score_breakdown: {
    type_weight: number;
    relevance_contrib: number;
    certainty_contrib: number;
    source_quality_contrib: number;
    freshness_contrib: number;
    novelty_contrib: number;
    conflict_risk_penalty: number;
    duplicate_penalty: number;
  };
}

/**
 * Hard constraint configuration
 */
export interface HardConstraints {
  /**
   * Categories that must always have at least one item included
   */
  required_categories: BidMemoryType[];
  
  /**
   * Minimum items per category (category -> min count)
   */
  category_minima: Partial<Record<BidMemoryType, number>>;
  
  /**
   * Maximum percentage of token budget per category
   */
  category_maxima: Partial<Record<BidMemoryType, number>>;
  
  /**
   * Cosine similarity threshold for duplicate suppression
   */
  duplicate_similarity_threshold: number;
  
  /**
   * Items that must always be included regardless of score
   */
  always_include_ids?: string[];
}

export const DEFAULT_HARD_CONSTRAINTS: HardConstraints = {
  required_categories: ['goal', 'constraint', 'fact', 'recent_state'],
  category_minima: {
    goal: 1,
    constraint: 1,
    fact: 1,
    recent_state: 1,
  },
  category_maxima: {
    goal: 0.20,           // 20% max
    constraint: 0.25,     // 25% max
    fact: 0.40,           // 40% max
    recent_state: 0.40,   // 40% max
    decision: 0.30,       // 30% max
    event: 0.30,          // 30% max
    preference: 0.15,     // 15% max
    conversation: 0.40,   // 40% max
  },
  duplicate_similarity_threshold: 0.85,
};

/**
 * Uncertainty voucher state
 */
export interface UncertaintyVoucher {
  triggered: boolean;
  reason: UncertaintyReason;
  reserved_budget: number;
  evidence_to_fetch: string[];
}

export type UncertaintyReason =
  | 'low_confidence'      // Selector confidence < 0.65
  | 'factual_conflict'    // Conflicting facts detected
  | 'missing_category'    // Required category missing
  | 'none';               // No uncertainty

/**
 * Full selection result with decision trace
 */
export interface BidSelectionResult {
  selected: ScoredBidCandidate[];
  excluded: ScoredBidCandidate[];
  
  // Token accounting
  total_tokens_used: number;
  token_budget: number;
  budget_remaining: number;
  
  // Uncertainty handling
  uncertainty_voucher?: UncertaintyVoucher;
  
  // Decision trace for auditability
  decision_trace: DecisionTrace;
  
  // Shadow mode comparison (if enabled)
  shadow_comparison?: ShadowComparison;
}

/**
 * Full decision trace for 100% traceability
 */
export interface DecisionTrace {
  run_id: string;
  timestamp: string;
  
  // Input summary
  total_candidates: number;
  token_budget: number;
  
  // Selection summary
  included_count: number;
  excluded_count: number;
  
  // Per-candidate decisions
  decisions: CandidateDecision[];
  
  // Constraint enforcement log
  constraint_enforcement: ConstraintEnforcementLog[];
  
  // Duplicate suppression log
  duplicates_suppressed: DuplicateSuppression[];
  
  // Category allocation
  category_allocation: Record<BidMemoryType, CategoryStats>;
  
  // Selector confidence
  overall_confidence: number;
  
  // Latency tracking
  selection_latency_ms: number;
}

/**
 * Per-candidate decision record
 */
export interface CandidateDecision {
  candidate_id: string;
  memory_type: BidMemoryType;
  included: boolean;
  score: number;
  score_breakdown: ScoredBidCandidate['score_breakdown'];
  reason: string;
  rank: number;
}

/**
 * Constraint enforcement record
 */
export interface ConstraintEnforcementLog {
  constraint_type: 'required_category' | 'category_minimum' | 'category_maximum' | 'always_include';
  category?: BidMemoryType;
  action: string;
  affected_candidates: string[];
}

/**
 * Duplicate suppression record
 */
export interface DuplicateSuppression {
  suppressed_id: string;
  duplicate_of_id: string;
  similarity: number;
}

/**
 * Category statistics
 */
export interface CategoryStats {
  count: number;
  tokens_used: number;
  percentage_of_budget: number;
  capped: boolean;
}

/**
 * Shadow mode comparison with baseline
 */
export interface ShadowComparison {
  baseline_method: 'recency' | 'similarity';
  baseline_selected_ids: string[];
  bid_market_selected_ids: string[];
  
  // Overlap analysis
  common_ids: string[];
  bid_only_ids: string[];
  baseline_only_ids: string[];
  
  // Quality metrics (if available)
  estimated_quality_delta?: number;
}

/**
 * Bid market configuration
 */
export interface BidMarketConfig {
  scoring_weights?: BidScoringWeights;
  hard_constraints?: HardConstraints;
  
  // Uncertainty voucher settings
  confidence_threshold?: number;  // Default: 0.65
  voucher_budget_percent?: number;  // Default: 0.12 (10-15%)
  
  // Shadow mode
  enable_shadow_mode?: boolean;
  shadow_baseline?: 'recency' | 'similarity';
  
  // Performance
  max_candidates?: number;
  target_latency_ms?: number;  // Default: 50ms p95
}

export const DEFAULT_BID_MARKET_CONFIG: Required<BidMarketConfig> = {
  scoring_weights: DEFAULT_BID_SCORING_WEIGHTS,
  hard_constraints: DEFAULT_HARD_CONSTRAINTS,
  confidence_threshold: 0.65,
  voucher_budget_percent: 0.12,
  enable_shadow_mode: false,
  shadow_baseline: 'recency',
  max_candidates: 1000,
  target_latency_ms: 50,
};
