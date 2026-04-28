/**
 * Signal Fitness League - Types
 * Issue #71: Memory Optimization Engine
 *
 * Continuous, production-grounded ranking loop to keep only memory
 * that improves outcomes, while preserving rare high-impact knowledge.
 */

/**
 * Memory unit classification for fitness tracking
 */
export type MemorySource =
  | 'user'           // User-provided information
  | 'conversation'   // Extracted from conversations
  | 'tool'           // Tool/skill output
  | 'inference'      // Model-inferred knowledge
  | 'system'         // System-level facts
  | 'external';      // External data sources

/**
 * Intent tags for memory categorization
 */
export type IntentTag =
  | 'preference'     // User preference
  | 'fact'           // Factual knowledge
  | 'procedure'      // How-to knowledge
  | 'constraint'     // Rules/limitations
  | 'goal'           // Active objectives
  | 'context'        // Situational context
  | 'relationship'   // Entity relationships
  | 'history';       // Historical events

/**
 * Criticality classification for safety layer
 */
export type CriticalityClass =
  | 'normal'         // Can be auto-dropped
  | 'important'      // Requires N failures before demotion
  | 'protected'      // Never auto-drop, manual review only
  | 'compliance';    // Never auto-drop, regulatory/security

/**
 * Memory Unit - The fundamental tracked snippet
 * Extended schema per Issue #71 spec
 */
export interface MemoryUnit {
  id: string;
  content: string;
  
  // Metadata
  source: MemorySource;
  topic: string;
  intent_tags: IntentTag[];
  owner_id?: string;           // Agent/user that owns this memory
  
  // Temporal tracking
  created_at: string;
  updated_at: string;
  last_accessed_at?: string;
  access_count: number;
  
  // Fitness tracking
  criticality: CriticalityClass;
  token_cost: number;
  
  // Embedding for semantic similarity
  embedding?: number[];
  
  // Additional metadata
  metadata?: Record<string, unknown>;
}

/**
 * Scoring weights for fitness calculation
 * Formula: fitness = wq*Δquality - wt*Δtokens - wl*Δlatency + wr*rarity_bonus
 */
export interface FitnessWeights {
  /** Weight for quality delta (positive = better with memory) */
  quality: number;
  /** Weight for token cost (negative impact) */
  tokens: number;
  /** Weight for latency delta (negative impact) */
  latency: number;
  /** Weight for rarity bonus (preserves rare knowledge) */
  rarity: number;
}

export const DEFAULT_FITNESS_WEIGHTS: FitnessWeights = {
  quality: 0.50,
  tokens: 0.20,
  latency: 0.10,
  rarity: 0.20,
};

/**
 * Quality metrics from paired inference
 */
export interface QualityMetrics {
  /** Answer correctness (0-1) */
  correctness: number;
  /** Coherence/fluency (0-1) */
  coherence: number;
  /** Completeness (0-1) */
  completeness: number;
  /** Relevance to prompt (0-1) */
  relevance: number;
  /** Aggregate quality score (0-1) */
  aggregate: number;
}

/**
 * Single evaluation result from shadow inference
 */
export interface EvaluationResult {
  id: string;
  memory_id: string;
  
  // Evaluation context
  prompt_id: string;
  model_version: string;
  evaluated_at: string;
  
  // Baseline (with memory) metrics
  baseline_quality: QualityMetrics;
  baseline_tokens: number;
  baseline_latency_ms: number;
  
  // Ablation (without memory) metrics
  ablation_quality: QualityMetrics;
  ablation_tokens: number;
  ablation_latency_ms: number;
  
  // Computed deltas
  delta_quality: number;      // positive = memory helped
  delta_tokens: number;       // positive = memory cost tokens
  delta_latency_ms: number;   // positive = memory added latency
}

/**
 * Aggregated fitness score for a memory unit
 */
export interface FitnessScore {
  memory_id: string;
  
  // Core fitness score
  fitness: number;
  
  // Score breakdown
  quality_contribution: number;
  token_penalty: number;
  latency_penalty: number;
  rarity_bonus: number;
  
  // Statistics
  evaluation_count: number;
  avg_delta_quality: number;
  avg_delta_tokens: number;
  avg_delta_latency_ms: number;
  
  // Confidence interval
  confidence: number;         // 0-1, based on evaluation count
  std_dev: number;
  
  // Trend
  trend: 'improving' | 'stable' | 'declining';
  last_evaluated_at: string;
  
  // Rarity metrics
  semantic_uniqueness: number;  // How unique in embedding space
  topic_coverage: number;       // Coverage of rare topics
}

/**
 * Promotion/demotion status
 */
export type PromotionStatus =
  | 'active'         // In active use
  | 'promoted'       // Recently promoted (boost)
  | 'demoted'        // Recently demoted (deprioritized)
  | 'archived'       // Removed from active set
  | 'protected';     // Cannot be demoted

/**
 * Policy decision record
 */
export interface PolicyDecision {
  id: string;
  memory_id: string;
  decided_at: string;
  
  // Decision details
  previous_status: PromotionStatus;
  new_status: PromotionStatus;
  reason: string;
  
  // Evidence
  fitness_score: number;
  evaluation_count: number;
  threshold_used: number;
  
  // Safety checks
  safety_override: boolean;
  override_reason?: string;
}

/**
 * Promotion/demotion thresholds
 */
export interface PolicyThresholds {
  /** Fitness threshold for promotion */
  promotion_threshold: number;
  /** Fitness threshold for demotion */
  demotion_threshold: number;
  /** Minimum evaluations before promotion */
  min_evaluations_promote: number;
  /** Minimum evaluations before demotion */
  min_evaluations_demote: number;
  /** Consecutive below-threshold before demotion */
  consecutive_failures_demote: number;
}

export const DEFAULT_POLICY_THRESHOLDS: PolicyThresholds = {
  promotion_threshold: 0.60,
  demotion_threshold: 0.20,
  min_evaluations_promote: 5,
  min_evaluations_demote: 10,
  consecutive_failures_demote: 3,
};

/**
 * Shadow evaluation configuration
 */
export interface ShadowEvalConfig {
  /** Percentage of traffic to sample (0-1) */
  sample_rate: number;
  /** Maximum evaluations per memory per day */
  max_evals_per_memory_daily: number;
  /** Model version to use for evaluation */
  model_version: string;
  /** Timeout for inference in ms */
  inference_timeout_ms: number;
  /** Enable quality scoring (requires LLM-as-judge) */
  enable_quality_scoring: boolean;
}

export const DEFAULT_SHADOW_EVAL_CONFIG: ShadowEvalConfig = {
  sample_rate: 0.05,           // 5% of traffic
  max_evals_per_memory_daily: 10,
  model_version: 'default',
  inference_timeout_ms: 30000,
  enable_quality_scoring: true,
};

/**
 * Full fitness league configuration
 */
export interface FitnessLeagueConfig {
  weights: FitnessWeights;
  thresholds: PolicyThresholds;
  shadow_eval: ShadowEvalConfig;
  
  /** Enable automatic promotion/demotion */
  auto_policy: boolean;
  /** Log all decisions for audit */
  audit_logging: boolean;
  /** Protected memory IDs (never auto-drop) */
  protected_ids: string[];
}

export const DEFAULT_FITNESS_LEAGUE_CONFIG: FitnessLeagueConfig = {
  weights: DEFAULT_FITNESS_WEIGHTS,
  thresholds: DEFAULT_POLICY_THRESHOLDS,
  shadow_eval: DEFAULT_SHADOW_EVAL_CONFIG,
  auto_policy: false,           // Disabled by default for safety
  audit_logging: true,
  protected_ids: [],
};

/**
 * Registry statistics
 */
export interface RegistryStats {
  total_memories: number;
  active_memories: number;
  archived_memories: number;
  protected_memories: number;
  
  total_tokens: number;
  active_tokens: number;
  
  avg_fitness: number;
  evaluations_today: number;
  promotions_today: number;
  demotions_today: number;
}

/**
 * Rarity analysis result
 */
export interface RarityAnalysis {
  memory_id: string;
  
  // Semantic uniqueness (distance from nearest neighbors)
  nearest_neighbor_distance: number;
  avg_cluster_distance: number;
  
  // Topic coverage
  topic: string;
  topic_frequency: number;       // How common is this topic
  topic_importance: number;      // Weighted importance
  
  // Final rarity score
  rarity_score: number;          // 0-1, higher = rarer
}

/**
 * Objective pack for evaluation
 * Different evaluation criteria for different use cases
 */
export interface ObjectivePack {
  id: string;
  name: string;
  description: string;
  
  // Quality metric weights
  correctness_weight: number;
  coherence_weight: number;
  completeness_weight: number;
  relevance_weight: number;
  
  // Evaluation prompts (for LLM-as-judge)
  judge_prompt?: string;
  reference_answers?: Record<string, string>;
}

export const DEFAULT_OBJECTIVE_PACK: ObjectivePack = {
  id: 'default',
  name: 'Default Quality Pack',
  description: 'Balanced quality evaluation across all metrics',
  correctness_weight: 0.30,
  coherence_weight: 0.20,
  completeness_weight: 0.25,
  relevance_weight: 0.25,
};

/**
 * Dashboard metrics snapshot
 */
export interface DashboardMetrics {
  timestamp: string;
  
  // Overview
  registry_stats: RegistryStats;
  
  // Top performers
  top_fitness: Array<{ memory_id: string; fitness: number; topic: string }>;
  
  // At risk
  at_risk: Array<{ memory_id: string; fitness: number; consecutive_failures: number }>;
  
  // Recent decisions
  recent_decisions: PolicyDecision[];
  
  // Token efficiency
  token_reduction_percent: number;
  quality_delta: number;
  latency_delta_ms: number;
}
