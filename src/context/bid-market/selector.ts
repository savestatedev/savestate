/**
 * Policy-Governed Working-Set Bid Market - Selector
 * Issue #72: Deterministic, auditable context selection
 *
 * Implements the scoring formula:
 * score = w_type + 0.30*relevance + 0.20*certainty + 0.15*source_quality
 *         + 0.15*freshness + 0.10*novelty - 0.20*conflict_risk
 */

import { randomUUID } from 'crypto';
import {
  BidCandidate,
  BidMemoryType,
  ScoredBidCandidate,
  BidScoringWeights,
  BidMarketConfig,
  BidSelectionResult,
  DecisionTrace,
  CandidateDecision,
  ConstraintEnforcementLog,
  DuplicateSuppression,
  CategoryStats,
  UncertaintyVoucher,
  ShadowComparison,
  MEMORY_TYPE_WEIGHTS,
  DEFAULT_BID_MARKET_CONFIG,
  DEFAULT_BID_SCORING_WEIGHTS,
  DEFAULT_HARD_CONSTRAINTS,
} from './types.js';

/**
 * Calculate the bid score for a candidate
 */
export function calculateBidScore(
  candidate: BidCandidate,
  weights: BidScoringWeights = DEFAULT_BID_SCORING_WEIGHTS
): { score: number; breakdown: ScoredBidCandidate['score_breakdown'] } {
  const type_weight = MEMORY_TYPE_WEIGHTS[candidate.memory_type] ?? 0.05;
  
  const relevance_contrib = weights.relevance * candidate.relevance;
  const certainty_contrib = weights.certainty * candidate.certainty;
  const source_quality_contrib = weights.source_quality * candidate.source_quality;
  const freshness_contrib = weights.freshness * candidate.freshness;
  const novelty_contrib = weights.novelty * candidate.novelty;
  const conflict_risk_penalty = weights.conflict_risk * candidate.conflict_risk;
  
  const score =
    type_weight +
    relevance_contrib +
    certainty_contrib +
    source_quality_contrib +
    freshness_contrib +
    novelty_contrib -
    conflict_risk_penalty;
  
  return {
    score,
    breakdown: {
      type_weight,
      relevance_contrib,
      certainty_contrib,
      source_quality_contrib,
      freshness_contrib,
      novelty_contrib,
      conflict_risk_penalty,
      duplicate_penalty: 0, // Will be updated during duplicate suppression
    },
  };
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Check if two candidates are duplicates based on similarity
 */
export function areDuplicates(
  a: BidCandidate,
  b: BidCandidate,
  threshold: number
): { isDuplicate: boolean; similarity: number } {
  // Use embeddings if available
  if (a.embedding && b.embedding) {
    const similarity = cosineSimilarity(a.embedding, b.embedding);
    return { isDuplicate: similarity >= threshold, similarity };
  }
  
  // Fallback to content-based similarity (Jaccard)
  const aWords = new Set(a.content.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const bWords = new Set(b.content.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  const intersection = [...aWords].filter(w => bWords.has(w)).length;
  const union = new Set([...aWords, ...bWords]).size;
  
  const similarity = union === 0 ? 0 : intersection / union;
  return { isDuplicate: similarity >= threshold, similarity };
}

/**
 * The Bid Market Selector - main selection engine
 */
export class BidMarketSelector {
  private config: Required<BidMarketConfig>;
  
  constructor(config: BidMarketConfig = {}) {
    this.config = {
      ...DEFAULT_BID_MARKET_CONFIG,
      ...config,
      scoring_weights: { ...DEFAULT_BID_SCORING_WEIGHTS, ...config.scoring_weights },
      hard_constraints: { ...DEFAULT_HARD_CONSTRAINTS, ...config.hard_constraints },
    };
  }
  
  /**
   * Select the optimal working set from candidates
   */
  select(
    candidates: BidCandidate[],
    tokenBudget: number,
    taskEmbedding?: number[]
  ): BidSelectionResult {
    const startTime = performance.now();
    const runId = randomUUID();
    
    // Limit candidates for performance
    const limitedCandidates = candidates.slice(0, this.config.max_candidates);
    
    // Phase 1: Score all candidates
    const scored = this.scoreAllCandidates(limitedCandidates, taskEmbedding);
    
    // Phase 2: Apply duplicate suppression
    const { unique, suppressed } = this.suppressDuplicates(scored);
    
    // Phase 3: Enforce hard constraints and select within budget
    const { selected, excluded, constraintLogs, categoryStats } = 
      this.enforceConstraintsAndSelect(unique, tokenBudget);
    
    // Phase 4: Check for uncertainty and reserve voucher budget if needed
    const { voucher, adjustedSelected, adjustedExcluded } = 
      this.handleUncertainty(selected, excluded, tokenBudget, categoryStats);
    
    // Phase 5: Generate decision trace
    const selectionLatency = performance.now() - startTime;
    const decisionTrace = this.generateDecisionTrace(
      runId,
      limitedCandidates.length,
      tokenBudget,
      adjustedSelected,
      adjustedExcluded,
      constraintLogs,
      suppressed,
      categoryStats,
      selectionLatency
    );
    
    // Phase 6: Shadow mode comparison (if enabled)
    const shadowComparison = this.config.enable_shadow_mode
      ? this.runShadowComparison(limitedCandidates, adjustedSelected, tokenBudget)
      : undefined;
    
    const totalTokensUsed = adjustedSelected.reduce((sum, c) => sum + c.token_cost, 0);
    
    return {
      selected: adjustedSelected,
      excluded: adjustedExcluded,
      total_tokens_used: totalTokensUsed,
      token_budget: tokenBudget,
      budget_remaining: tokenBudget - totalTokensUsed,
      uncertainty_voucher: voucher,
      decision_trace: decisionTrace,
      shadow_comparison: shadowComparison,
    };
  }
  
  /**
   * Score all candidates
   */
  private scoreAllCandidates(
    candidates: BidCandidate[],
    taskEmbedding?: number[]
  ): ScoredBidCandidate[] {
    return candidates.map(candidate => {
      // Boost relevance if we have task embedding
      let adjustedCandidate = candidate;
      if (taskEmbedding && candidate.embedding) {
        const semanticRelevance = cosineSimilarity(taskEmbedding, candidate.embedding);
        adjustedCandidate = {
          ...candidate,
          relevance: Math.max(candidate.relevance, semanticRelevance),
        };
      }
      
      const { score, breakdown } = calculateBidScore(adjustedCandidate, this.config.scoring_weights);
      
      return {
        ...adjustedCandidate,
        score,
        score_breakdown: breakdown,
      };
    }).sort((a, b) => b.score - a.score);
  }
  
  /**
   * Suppress duplicates - similar candidates compete as one slot
   */
  private suppressDuplicates(
    scored: ScoredBidCandidate[]
  ): { unique: ScoredBidCandidate[]; suppressed: DuplicateSuppression[] } {
    const unique: ScoredBidCandidate[] = [];
    const suppressed: DuplicateSuppression[] = [];
    const threshold = this.config.hard_constraints.duplicate_similarity_threshold;
    
    for (const candidate of scored) {
      let isDuplicate = false;
      
      for (const kept of unique) {
        const { isDuplicate: dup, similarity } = areDuplicates(candidate, kept, threshold);
        if (dup) {
          // Keep the higher-scored one (already in unique since sorted)
          suppressed.push({
            suppressed_id: candidate.id,
            duplicate_of_id: kept.id,
            similarity,
          });
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        unique.push(candidate);
      }
    }
    
    return { unique, suppressed };
  }
  
  /**
   * Enforce hard constraints and select within budget
   */
  private enforceConstraintsAndSelect(
    candidates: ScoredBidCandidate[],
    tokenBudget: number
  ): {
    selected: ScoredBidCandidate[];
    excluded: ScoredBidCandidate[];
    constraintLogs: ConstraintEnforcementLog[];
    categoryStats: Record<BidMemoryType, CategoryStats>;
  } {
    const selected: ScoredBidCandidate[] = [];
    const excluded: ScoredBidCandidate[] = [];
    const constraintLogs: ConstraintEnforcementLog[] = [];
    
    const { hard_constraints } = this.config;
    let tokensUsed = 0;
    
    // Track per-category stats
    const categoryStats: Record<BidMemoryType, CategoryStats> = {} as any;
    const memoryTypes: BidMemoryType[] = [
      'goal', 'constraint', 'fact', 'recent_state',
      'decision', 'event', 'preference', 'conversation'
    ];
    for (const type of memoryTypes) {
      categoryStats[type] = { count: 0, tokens_used: 0, percentage_of_budget: 0, capped: false };
    }
    
    // Phase A: Always include required items
    if (hard_constraints.always_include_ids?.length) {
      const alwaysInclude = candidates.filter(
        c => hard_constraints.always_include_ids!.includes(c.id)
      );
      for (const c of alwaysInclude) {
        selected.push(c);
        tokensUsed += c.token_cost;
        categoryStats[c.memory_type].count++;
        categoryStats[c.memory_type].tokens_used += c.token_cost;
      }
      
      if (alwaysInclude.length > 0) {
        constraintLogs.push({
          constraint_type: 'always_include',
          action: `Included ${alwaysInclude.length} always-include items`,
          affected_candidates: alwaysInclude.map(c => c.id),
        });
      }
    }
    
    // Phase B: Ensure category minima are met (enforce BEFORE general selection)
    const selectedIds = new Set(selected.map(c => c.id));
    
    for (const [category, minCount] of Object.entries(hard_constraints.category_minima)) {
      const catType = category as BidMemoryType;
      const currentCount = categoryStats[catType]?.count ?? 0;
      
      if (currentCount < minCount) {
        const needed = minCount - currentCount;
        const available = candidates
          .filter(c => c.memory_type === catType && !selectedIds.has(c.id))
          .slice(0, needed);
        
        const actuallyAdded: string[] = [];
        for (const c of available) {
          if (tokensUsed + c.token_cost <= tokenBudget) {
            selected.push(c);
            selectedIds.add(c.id);
            tokensUsed += c.token_cost;
            categoryStats[catType].count++;
            categoryStats[catType].tokens_used += c.token_cost;
            actuallyAdded.push(c.id);
          }
        }
        
        if (actuallyAdded.length > 0) {
          constraintLogs.push({
            constraint_type: 'category_minimum',
            category: catType,
            action: `Added ${actuallyAdded.length} items to meet minimum of ${minCount}`,
            affected_candidates: actuallyAdded,
          });
        }
      }
    }
    
    // Phase C: Fill remaining budget with highest-scoring candidates
    // (selectedIds already updated in Phase B)
    const remaining = candidates.filter(c => !selectedIds.has(c.id));
    
    for (const candidate of remaining) {
      const catType = candidate.memory_type;
      const maxPercent = hard_constraints.category_maxima[catType] ?? 1.0;
      const maxTokens = tokenBudget * maxPercent;
      
      // Check category maximum
      const catTokens = categoryStats[catType]?.tokens_used ?? 0;
      if (catTokens + candidate.token_cost > maxTokens) {
        if (!categoryStats[catType].capped) {
          categoryStats[catType].capped = true;
          constraintLogs.push({
            constraint_type: 'category_maximum',
            category: catType,
            action: `Category capped at ${Math.round(maxPercent * 100)}% of budget`,
            affected_candidates: [candidate.id],
          });
        }
        excluded.push(candidate);
        continue;
      }
      
      // Check total budget
      if (tokensUsed + candidate.token_cost > tokenBudget) {
        excluded.push(candidate);
        continue;
      }
      
      // Include candidate
      selected.push(candidate);
      tokensUsed += candidate.token_cost;
      categoryStats[catType].count++;
      categoryStats[catType].tokens_used += candidate.token_cost;
    }
    
    // Phase D: Check required categories
    for (const requiredCat of hard_constraints.required_categories) {
      if ((categoryStats[requiredCat]?.count ?? 0) === 0) {
        constraintLogs.push({
          constraint_type: 'required_category',
          category: requiredCat,
          action: `WARNING: Required category ${requiredCat} has no items`,
          affected_candidates: [],
        });
      }
    }
    
    // Calculate final percentages
    for (const type of memoryTypes) {
      categoryStats[type].percentage_of_budget = 
        tokenBudget > 0 ? categoryStats[type].tokens_used / tokenBudget : 0;
    }
    
    return { selected, excluded, constraintLogs, categoryStats };
  }
  
  /**
   * Handle uncertainty - reserve budget for evidence gathering
   */
  private handleUncertainty(
    selected: ScoredBidCandidate[],
    excluded: ScoredBidCandidate[],
    tokenBudget: number,
    categoryStats: Record<BidMemoryType, CategoryStats>
  ): {
    voucher: UncertaintyVoucher | undefined;
    adjustedSelected: ScoredBidCandidate[];
    adjustedExcluded: ScoredBidCandidate[];
  } {
    const { confidence_threshold, voucher_budget_percent, hard_constraints } = this.config;
    
    // Calculate overall confidence
    const avgCertainty = selected.length > 0
      ? selected.reduce((sum, c) => sum + c.certainty, 0) / selected.length
      : 0;
    
    // Check for missing required categories
    const missingCategories = hard_constraints.required_categories.filter(
      cat => (categoryStats[cat]?.count ?? 0) === 0
    );
    
    // Check for conflicts
    const highConflictRisk = selected.filter(c => c.conflict_risk > 0.5).length > 0;
    
    // Determine if voucher is needed
    let reason: 'low_confidence' | 'factual_conflict' | 'missing_category' | 'none' = 'none';
    const evidenceToFetch: string[] = [];
    
    if (avgCertainty < confidence_threshold) {
      reason = 'low_confidence';
      evidenceToFetch.push('Verify low-certainty facts', 'Fetch additional context');
    } else if (highConflictRisk) {
      reason = 'factual_conflict';
      evidenceToFetch.push('Resolve conflicting facts', 'Verify primary sources');
    } else if (missingCategories.length > 0) {
      reason = 'missing_category';
      evidenceToFetch.push(
        ...missingCategories.map(cat => `Fetch items for required category: ${cat}`)
      );
    }
    
    if (reason === 'none') {
      return { voucher: undefined, adjustedSelected: selected, adjustedExcluded: excluded };
    }
    
    // Reserve budget for uncertainty voucher
    const reservedBudget = Math.floor(tokenBudget * voucher_budget_percent);
    const targetTokens = tokenBudget - reservedBudget;
    
    // Trim selected items to make room for voucher
    const adjustedSelected: ScoredBidCandidate[] = [];
    const adjustedExcluded: ScoredBidCandidate[] = [...excluded];
    let currentTokens = 0;
    
    // Sort by score to keep highest-value items
    const sortedSelected = [...selected].sort((a, b) => b.score - a.score);
    
    for (const candidate of sortedSelected) {
      if (currentTokens + candidate.token_cost <= targetTokens) {
        adjustedSelected.push(candidate);
        currentTokens += candidate.token_cost;
      } else {
        adjustedExcluded.push(candidate);
      }
    }
    
    const voucher: UncertaintyVoucher = {
      triggered: true,
      reason,
      reserved_budget: reservedBudget,
      evidence_to_fetch: evidenceToFetch,
    };
    
    return { voucher, adjustedSelected, adjustedExcluded };
  }
  
  /**
   * Generate complete decision trace for auditability
   */
  private generateDecisionTrace(
    runId: string,
    totalCandidates: number,
    tokenBudget: number,
    selected: ScoredBidCandidate[],
    excluded: ScoredBidCandidate[],
    constraintLogs: ConstraintEnforcementLog[],
    suppressed: DuplicateSuppression[],
    categoryStats: Record<BidMemoryType, CategoryStats>,
    latencyMs: number
  ): DecisionTrace {
    const allCandidates = [...selected, ...excluded];
    
    // Sort by score for ranking
    const rankedCandidates = [...allCandidates].sort((a, b) => b.score - a.score);
    const rankMap = new Map(rankedCandidates.map((c, i) => [c.id, i + 1]));
    const selectedIds = new Set(selected.map(c => c.id));
    
    const decisions: CandidateDecision[] = rankedCandidates.map(c => ({
      candidate_id: c.id,
      memory_type: c.memory_type,
      included: selectedIds.has(c.id),
      score: c.score,
      score_breakdown: c.score_breakdown,
      reason: selectedIds.has(c.id)
        ? `Selected: rank ${rankMap.get(c.id)}, score ${c.score.toFixed(4)}`
        : `Excluded: ${this.getExclusionReason(c, tokenBudget, categoryStats)}`,
      rank: rankMap.get(c.id)!,
    }));
    
    // Calculate overall confidence
    const avgCertainty = selected.length > 0
      ? selected.reduce((sum, c) => sum + c.certainty, 0) / selected.length
      : 0;
    
    return {
      run_id: runId,
      timestamp: new Date().toISOString(),
      total_candidates: totalCandidates,
      token_budget: tokenBudget,
      included_count: selected.length,
      excluded_count: excluded.length,
      decisions,
      constraint_enforcement: constraintLogs,
      duplicates_suppressed: suppressed,
      category_allocation: categoryStats,
      overall_confidence: avgCertainty,
      selection_latency_ms: latencyMs,
    };
  }
  
  /**
   * Get human-readable exclusion reason
   */
  private getExclusionReason(
    candidate: ScoredBidCandidate,
    tokenBudget: number,
    categoryStats: Record<BidMemoryType, CategoryStats>
  ): string {
    const maxPercent = this.config.hard_constraints.category_maxima[candidate.memory_type];
    if (maxPercent && categoryStats[candidate.memory_type]?.capped) {
      return `Category ${candidate.memory_type} capped at ${Math.round(maxPercent * 100)}%`;
    }
    
    return 'Budget exceeded or lower score than selected candidates';
  }
  
  /**
   * Run shadow comparison with baseline method
   */
  private runShadowComparison(
    candidates: BidCandidate[],
    bidSelected: ScoredBidCandidate[],
    tokenBudget: number
  ): ShadowComparison {
    const baseline = this.config.shadow_baseline;
    
    // Sort candidates by baseline method
    const sortedByBaseline = [...candidates].sort((a, b) => {
      if (baseline === 'recency') {
        const aTime = new Date(a.updated_at || a.created_at).getTime();
        const bTime = new Date(b.updated_at || b.created_at).getTime();
        return bTime - aTime; // Most recent first
      } else {
        // Similarity - use relevance score as proxy
        return b.relevance - a.relevance;
      }
    });
    
    // Select within budget using baseline method
    const baselineSelected: string[] = [];
    let tokensUsed = 0;
    
    for (const candidate of sortedByBaseline) {
      if (tokensUsed + candidate.token_cost <= tokenBudget) {
        baselineSelected.push(candidate.id);
        tokensUsed += candidate.token_cost;
      }
    }
    
    const bidSelectedIds = bidSelected.map(c => c.id);
    const commonIds = bidSelectedIds.filter(id => baselineSelected.includes(id));
    const bidOnlyIds = bidSelectedIds.filter(id => !baselineSelected.includes(id));
    const baselineOnlyIds = baselineSelected.filter(id => !bidSelectedIds.includes(id));
    
    return {
      baseline_method: baseline,
      baseline_selected_ids: baselineSelected,
      bid_market_selected_ids: bidSelectedIds,
      common_ids: commonIds,
      bid_only_ids: bidOnlyIds,
      baseline_only_ids: baselineOnlyIds,
    };
  }
}
