/**
 * Signal Fitness League - Fitness Scorer
 * Issue #71: Calculate fitness scores from evaluation results
 *
 * Formula: fitness = wq*Δquality - wt*Δtokens - wl*Δlatency + wr*rarity_bonus
 */

import {
  EvaluationResult,
  FitnessScore,
  FitnessWeights,
  RarityAnalysis,
  DEFAULT_FITNESS_WEIGHTS,
} from './types.js';

/**
 * Score calculation options
 */
export interface ScoringOptions {
  weights?: FitnessWeights;
  /** Minimum evaluations for high confidence */
  min_evaluations_high_confidence?: number;
  /** Token normalization factor (average expected tokens) */
  token_normalization_factor?: number;
  /** Latency normalization factor (average expected latency in ms) */
  latency_normalization_factor?: number;
}

const DEFAULT_SCORING_OPTIONS: Required<ScoringOptions> = {
  weights: DEFAULT_FITNESS_WEIGHTS,
  min_evaluations_high_confidence: 10,
  token_normalization_factor: 100,   // 100 tokens as baseline
  latency_normalization_factor: 500, // 500ms as baseline
};

/**
 * Statistics helper for calculating mean, std dev, etc.
 */
interface Statistics {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  count: number;
}

function calculateStatistics(values: number[]): Statistics {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, count: 0 };
  }
  
  const count = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / count;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  return { mean, stdDev, min, max, count };
}

/**
 * Fitness Scorer - Calculates fitness scores from evaluation results
 */
export class FitnessScorer {
  private options: Required<ScoringOptions>;

  constructor(options: ScoringOptions = {}) {
    this.options = {
      ...DEFAULT_SCORING_OPTIONS,
      ...options,
      weights: { ...DEFAULT_FITNESS_WEIGHTS, ...options.weights },
    };
  }

  /**
   * Calculate fitness score from evaluation results
   */
  calculate(
    memoryId: string,
    evaluations: EvaluationResult[],
    rarity?: RarityAnalysis
  ): FitnessScore {
    if (evaluations.length === 0) {
      return this.createDefaultScore(memoryId);
    }
    
    const { weights, token_normalization_factor, latency_normalization_factor } = this.options;
    
    // Extract deltas
    const qualityDeltas = evaluations.map(e => e.delta_quality);
    const tokenDeltas = evaluations.map(e => e.delta_tokens);
    const latencyDeltas = evaluations.map(e => e.delta_latency_ms);
    
    // Calculate statistics
    const qualityStats = calculateStatistics(qualityDeltas);
    const tokenStats = calculateStatistics(tokenDeltas);
    const latencyStats = calculateStatistics(latencyDeltas);
    
    // Normalize deltas to 0-1 scale (or -1 to 1 for quality)
    // Quality: already in -1 to 1 range (difference of 0-1 scores)
    const normalizedQuality = qualityStats.mean;
    
    // Tokens: normalize by expected token cost, cap at 1
    const normalizedTokens = Math.min(1, Math.abs(tokenStats.mean) / token_normalization_factor);
    
    // Latency: normalize by expected latency, cap at 1
    const normalizedLatency = Math.min(1, Math.abs(latencyStats.mean) / latency_normalization_factor);
    
    // Rarity bonus (0-1)
    const rarityBonus = rarity?.rarity_score ?? 0;
    
    // Calculate component contributions
    const qualityContribution = weights.quality * normalizedQuality;
    const tokenPenalty = weights.tokens * normalizedTokens * (tokenStats.mean > 0 ? 1 : -1);
    const latencyPenalty = weights.latency * normalizedLatency * (latencyStats.mean > 0 ? 1 : -1);
    const rarityContribution = weights.rarity * rarityBonus;
    
    // Final fitness score
    // Positive quality delta = good, positive token/latency delta = bad
    const fitness = qualityContribution - tokenPenalty - latencyPenalty + rarityContribution;
    
    // Normalize to 0-1 range with sigmoid-like scaling
    const normalizedFitness = this.normalize(fitness);
    
    // Calculate confidence based on evaluation count
    const confidence = this.calculateConfidence(evaluations.length);
    
    // Determine trend
    const trend = this.calculateTrend(evaluations);
    
    // Get last evaluation timestamp
    const lastEvaluatedAt = evaluations
      .map(e => e.evaluated_at)
      .sort()
      .reverse()[0];
    
    return {
      memory_id: memoryId,
      fitness: normalizedFitness,
      quality_contribution: qualityContribution,
      token_penalty: tokenPenalty,
      latency_penalty: latencyPenalty,
      rarity_bonus: rarityContribution,
      evaluation_count: evaluations.length,
      avg_delta_quality: qualityStats.mean,
      avg_delta_tokens: tokenStats.mean,
      avg_delta_latency_ms: latencyStats.mean,
      confidence,
      std_dev: qualityStats.stdDev,
      trend,
      last_evaluated_at: lastEvaluatedAt,
      semantic_uniqueness: rarity?.nearest_neighbor_distance ?? 0,
      topic_coverage: rarity?.topic_importance ?? 0,
    };
  }

  /**
   * Normalize fitness to 0-1 range using sigmoid-like function
   */
  private normalize(value: number): number {
    // Sigmoid transformation: maps (-inf, inf) to (0, 1)
    // Adjusted scale so typical values fall in 0.2-0.8 range
    return 1 / (1 + Math.exp(-3 * value));
  }

  /**
   * Calculate confidence based on evaluation count
   */
  private calculateConfidence(evalCount: number): number {
    const target = this.options.min_evaluations_high_confidence;
    // Logarithmic confidence curve
    return Math.min(1, Math.log(evalCount + 1) / Math.log(target + 1));
  }

  /**
   * Calculate trend from recent evaluations
   */
  private calculateTrend(evaluations: EvaluationResult[]): 'improving' | 'stable' | 'declining' {
    if (evaluations.length < 3) return 'stable';
    
    // Sort by timestamp
    const sorted = [...evaluations].sort(
      (a, b) => new Date(a.evaluated_at).getTime() - new Date(b.evaluated_at).getTime()
    );
    
    // Compare recent half vs older half
    const midpoint = Math.floor(sorted.length / 2);
    const recentEvals = sorted.slice(midpoint);
    const olderEvals = sorted.slice(0, midpoint);
    
    const recentAvg = recentEvals.reduce((sum, e) => sum + e.delta_quality, 0) / recentEvals.length;
    const olderAvg = olderEvals.reduce((sum, e) => sum + e.delta_quality, 0) / olderEvals.length;
    
    const diff = recentAvg - olderAvg;
    
    if (diff > 0.05) return 'improving';
    if (diff < -0.05) return 'declining';
    return 'stable';
  }

  /**
   * Create default score for memories without evaluations
   */
  private createDefaultScore(memoryId: string): FitnessScore {
    return {
      memory_id: memoryId,
      fitness: 0.5, // Neutral
      quality_contribution: 0,
      token_penalty: 0,
      latency_penalty: 0,
      rarity_bonus: 0,
      evaluation_count: 0,
      avg_delta_quality: 0,
      avg_delta_tokens: 0,
      avg_delta_latency_ms: 0,
      confidence: 0,
      std_dev: 0,
      trend: 'stable',
      last_evaluated_at: new Date().toISOString(),
      semantic_uniqueness: 0,
      topic_coverage: 0,
    };
  }

  /**
   * Compare two fitness scores
   */
  compare(a: FitnessScore, b: FitnessScore): number {
    // Primary: compare fitness
    const fitnessDiff = b.fitness - a.fitness;
    if (Math.abs(fitnessDiff) > 0.01) return fitnessDiff;
    
    // Secondary: compare confidence
    const confidenceDiff = b.confidence - a.confidence;
    if (Math.abs(confidenceDiff) > 0.1) return confidenceDiff;
    
    // Tertiary: compare rarity (prefer rarer memories)
    return b.rarity_bonus - a.rarity_bonus;
  }

  /**
   * Rank memories by fitness score
   */
  rank(scores: FitnessScore[]): FitnessScore[] {
    return [...scores].sort((a, b) => this.compare(a, b));
  }

  /**
   * Get fitness grade (A-F)
   */
  getGrade(fitness: number): string {
    if (fitness >= 0.80) return 'A';
    if (fitness >= 0.65) return 'B';
    if (fitness >= 0.50) return 'C';
    if (fitness >= 0.35) return 'D';
    return 'F';
  }

  /**
   * Check if score meets promotion threshold
   */
  meetsPromotionThreshold(score: FitnessScore, threshold: number, minEvaluations: number): boolean {
    return score.fitness >= threshold && score.evaluation_count >= minEvaluations;
  }

  /**
   * Check if score falls below demotion threshold
   */
  meetsDemotionThreshold(score: FitnessScore, threshold: number, minEvaluations: number): boolean {
    return score.fitness < threshold && score.evaluation_count >= minEvaluations;
  }

  /**
   * Get scoring options
   */
  getOptions(): Required<ScoringOptions> {
    return { ...this.options };
  }

  /**
   * Update scoring options
   */
  updateOptions(updates: Partial<ScoringOptions>): void {
    this.options = {
      ...this.options,
      ...updates,
      weights: { ...this.options.weights, ...updates.weights },
    };
  }
}

/**
 * Quick score calculation for single evaluation
 */
export function quickScore(
  evaluation: EvaluationResult,
  weights: FitnessWeights = DEFAULT_FITNESS_WEIGHTS
): number {
  const { delta_quality, delta_tokens, delta_latency_ms } = evaluation;
  
  // Simple scoring without normalization
  const qualityScore = weights.quality * delta_quality;
  const tokenPenalty = weights.tokens * (delta_tokens / 100);
  const latencyPenalty = weights.latency * (delta_latency_ms / 500);
  
  return qualityScore - tokenPenalty - latencyPenalty;
}

/**
 * Aggregate multiple quick scores
 */
export function aggregateQuickScores(scores: number[]): { mean: number; confidence: number } {
  if (scores.length === 0) {
    return { mean: 0, confidence: 0 };
  }
  
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const confidence = Math.min(1, Math.log(scores.length + 1) / Math.log(11));
  
  return { mean, confidence };
}
