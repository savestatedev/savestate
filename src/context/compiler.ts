/**
 * Preflight Context Compiler
 * Issue #54: Compile principled, auditable context for agent runs
 */

import { randomUUID } from 'crypto';
import {
  RunBrief,
  CompileRequest,
  ExplanationTrace,
  ValidationResult,
  CandidateExplanation,
  Fact,
  Entity,
  OpenLoop,
  Constraint,
  Decision,
  Unknown,
  Conflict,
  Citation,
  ScoringWeights,
  BudgetAllocation,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_BUDGET_ALLOCATION,
  ContextPressureThresholds,
  DEFAULT_PRESSURE_THRESHOLDS,
  ContextPressureState,
  ContextPressureLevel,
  ConstraintPinningConfig,
  DEFAULT_CONSTRAINT_PINNING,
  MemoryRefreshRecommendation,
} from './types.js';
import { Candidate, ScoredCandidate, rankCandidates } from './scorer.js';

export interface CompilerConfig {
  weights?: ScoringWeights;
  budget?: BudgetAllocation;
  minConstraintCoverage?: number;
  /** Context pressure thresholds */
  pressureThresholds?: ContextPressureThresholds;
  /** Constraint pinning configuration */
  constraintPinning?: ConstraintPinningConfig;
}

export interface CompileResult {
  brief: RunBrief;
  explanation: ExplanationTrace;
}

/**
 * The Preflight Context Compiler
 * 
 * Issue #169: Quiet Forgetting and Constraint Drift
 * - Context pressure monitoring at 60/75/90% thresholds
 * - Constraint pinning for policy/system/high-criticality constraints
 * - Memory refresh recommendations
 */
export class ContextCompiler {
  private weights: ScoringWeights;
  private budget: BudgetAllocation;
  private minConstraintCoverage: number;
  private pressureThresholds: ContextPressureThresholds;
  private constraintPinning: ConstraintPinningConfig;
  
  // Storage for explanation traces
  private traces: Map<string, ExplanationTrace> = new Map();
  
  // Track context pressure state for the current compilation
  private currentPressureState: ContextPressureState | null = null;

  constructor(config: CompilerConfig = {}) {
    this.weights = config.weights ?? DEFAULT_SCORING_WEIGHTS;
    this.budget = config.budget ?? DEFAULT_BUDGET_ALLOCATION;
    this.minConstraintCoverage = config.minConstraintCoverage ?? 0.99;
    this.pressureThresholds = config.pressureThresholds ?? DEFAULT_PRESSURE_THRESHOLDS;
    this.constraintPinning = config.constraintPinning ?? DEFAULT_CONSTRAINT_PINNING;
  }

  /**
   * Compile context for an agent run
   */
  async compile(
    request: CompileRequest,
    candidates: Candidate[]
  ): Promise<CompileResult> {
    const runId = randomUUID();
    const compiledAt = new Date().toISOString();
    
    // Extract keywords from task
    const taskKeywords = this.extractKeywords(request.task.intent);
    
    // Score and rank all candidates
    const scoredCandidates = rankCandidates(
      candidates,
      undefined, // TODO: Add embedding support
      taskKeywords,
      this.weights
    );
    
    // Allocate budget
    const budgetTokens = request.token_budget;
    const allocated = this.allocateBudget(budgetTokens);
    
    // Categorize and select candidates by type
    const categorized = this.categorizeCandidates(scoredCandidates);
    
    // Build the RunBrief
    const brief = this.buildBrief(
      runId,
      compiledAt,
      categorized,
      allocated,
      budgetTokens
    );
    
    // Generate explanation trace
    const explanation = this.generateExplanation(
      runId,
      compiledAt,
      scoredCandidates,
      brief,
      allocated
    );
    
    // Store trace for later retrieval
    this.traces.set(runId, explanation);
    
    return { brief, explanation };
  }

  /**
   * Get explanation trace for a run
   */
  getExplanation(runId: string): ExplanationTrace | undefined {
    return this.traces.get(runId);
  }

  /**
   * Validate a RunBrief
   */
  validate(brief: RunBrief): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check required fields
    if (!brief.run_id) errors.push('Missing run_id');
    if (!brief.compiled_at) errors.push('Missing compiled_at');
    if (brief.token_count < 0) errors.push('Invalid token_count');
    
    // Check constraints coverage
    const activeConstraints = brief.constraints.filter(c => c.active);
    const constraintsCovered = activeConstraints.length;
    const constraintsTotal = activeConstraints.length; // Would compare against known constraints
    
    if (constraintsCovered === 0 && constraintsTotal > 0) {
      errors.push('No constraints included');
    }
    
    // Check for must_know_facts
    const requiredFactsPresent = brief.must_know_facts.length > 0;
    if (!requiredFactsPresent) {
      warnings.push('No must_know_facts included');
    }
    
    // Check for unresolved conflicts
    if (brief.conflicts.length > 0) {
      warnings.push(`${brief.conflicts.length} unresolved conflicts present`);
    }
    
    // Check budget
    if (brief.budget_remaining < 0) {
      errors.push('Budget exceeded');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      coverage: {
        constraints_covered: constraintsCovered,
        constraints_total: constraintsTotal,
        required_facts_present: requiredFactsPresent,
      },
    };
  }

  // ============ Issue #169: Context Pressure Monitoring ============

  /**
   * Check context pressure level based on token utilization
   */
  checkContextPressure(utilizedTokens: number, totalBudget: number): ContextPressureState {
    const utilizationPercent = totalBudget > 0 ? utilizedTokens / totalBudget : 0;
    const triggeredThresholds: ContextPressureLevel[] = [];
    const recommendedActions: string[] = [];

    // Determine pressure level
    let level: ContextPressureLevel = 'normal';
    
    if (utilizationPercent >= this.pressureThresholds.emergency) {
      level = 'emergency';
      triggeredThresholds.push('emergency');
      recommendedActions.push(
        'EMERGENCY: Consider immediate snapshot and context refresh',
        'Drop all non-essential context immediately',
        'Pin all critical constraints'
      );
    } else if (utilizationPercent >= this.pressureThresholds.critical) {
      level = 'critical';
      triggeredThresholds.push('critical');
      recommendedActions.push(
        'CRITICAL: Initiate memory compaction',
        'Prioritize constraint preservation',
        'Consider triggering snapshot'
      );
    } else if (utilizationPercent >= this.pressureThresholds.warning) {
      level = 'warning';
      triggeredThresholds.push('warning');
      recommendedActions.push(
        'WARNING: Begin preparing for context pressure',
        'Identify low-priority memories for eviction',
        'Ensure critical constraints are pinned'
      );
    }

    // Store current pressure state
    this.currentPressureState = {
      level,
      utilizedTokens,
      totalBudget,
      utilizationPercent,
      triggeredThresholds,
      recommendedActions,
    };

    return this.currentPressureState;
  }

  /**
   * Get the current context pressure state
   */
  getCurrentPressureState(): ContextPressureState | null {
    return this.currentPressureState;
  }

  /**
   * Get pressure thresholds configuration
   */
  getPressureThresholds(): ContextPressureThresholds {
    return { ...this.pressureThresholds };
  }

  // ============ Issue #169: Constraint Pinning ============

  /**
   * Identify constraints that must be pinned (never dropped)
   * These are protected regardless of budget pressure
   */
  getPinnedConstraints(candidates: ScoredCandidate[]): ScoredCandidate[] {
    const pinned: ScoredCandidate[] = [];
    const constraintCandidates = candidates.filter(c => c.type === 'constraint');
    
    for (const candidate of constraintCandidates) {
      if (pinned.length >= this.constraintPinning.maxPinnedConstraints) break;
      
      const constraintType = candidate.metadata?.constraint_type as string | undefined;
      const criticality = candidate.criticality ?? 0;
      
      // Pin policy constraints
      if (this.constraintPinning.pinPolicyConstraints && constraintType === 'policy') {
        pinned.push(candidate);
        continue;
      }
      
      // Pin system constraints
      if (this.constraintPinning.pinSystemConstraints && constraintType === 'system') {
        pinned.push(candidate);
        continue;
      }
      
      // Pin high-criticality constraints
      if (this.constraintPinning.pinHighCriticality && criticality >= 0.8) {
        pinned.push(candidate);
        continue;
      }
    }
    
    return pinned;
  }

  /**
   * Get constraint pinning configuration
   */
  getConstraintPinningConfig(): ConstraintPinningConfig {
    return { ...this.constraintPinning };
  }

  // ============ Issue #169: Memory Refresh Recommendations ============

  /**
   * Recommend memory refresh actions based on context pressure
   */
  getMemoryRefreshRecommendation(
    utilizedTokens: number,
    totalBudget: number,
    memoryCount: number
  ): MemoryRefreshRecommendation {
    const pressure = this.checkContextPressure(utilizedTokens, totalBudget);
    const suggestedActions: string[] = [];
    let shouldRefresh = false;
    let priority: 'low' | 'medium' | 'high' = 'low';
    
    switch (pressure.level) {
      case 'emergency':
        shouldRefresh = true;
        priority = 'high';
        suggestedActions.push(
          'Compact all eligible memories',
          'Archive completed task memories',
          'Evict memories below importance threshold 0.3'
        );
        break;
        
      case 'critical':
        shouldRefresh = true;
        priority = 'high';
        suggestedActions.push(
          'Begin memory compaction process',
          'Archive memories older than 7 days with low importance',
          'Consolidate similar memories'
        );
        break;
        
      case 'warning':
        // Only recommend if many memories exist
        if (memoryCount > 100) {
          shouldRefresh = true;
          priority = 'medium';
          suggestedActions.push(
            'Prepare for compaction by tagging old memories',
            'Identify redundant memories for consolidation'
          );
        }
        break;
        
      case 'normal':
      default:
        shouldRefresh = false;
        priority = 'low';
        break;
    }

    const reason = shouldRefresh
      ? `Context at ${(pressure.utilizationPercent * 100).toFixed(0)}% (${pressure.level} level)`
      : 'Context pressure within normal parameters';

    return {
      shouldRefresh,
      reason,
      suggestedActions,
      priority,
    };
  }

  /**
   * Extract keywords from task description
   */
  private extractKeywords(intent: string): string[] {
    // Simple keyword extraction - split on whitespace and filter common words
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'shall',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
      'and', 'or', 'but', 'not', 'no', 'yes', 'this', 'that',
    ]);
    
    return intent
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Allocate token budget across sections
   */
  private allocateBudget(totalTokens: number): Record<string, number> {
    return {
      must_know_facts: Math.floor(totalTokens * this.budget.must_know_facts_min),
      constraints: Math.floor(totalTokens * this.budget.constraints_min),
      open_loops: Math.floor(totalTokens * this.budget.open_loops_min),
      active_state: Math.floor(totalTokens * this.budget.active_state_max),
      recent_decisions: Math.floor(totalTokens * this.budget.recent_decisions_max),
      conflicts: Math.floor(totalTokens * this.budget.conflicts_max),
      unknowns: Math.floor(totalTokens * this.budget.unknowns_max),
      citations: Math.floor(totalTokens * this.budget.citations_max),
    };
  }

  /**
   * Categorize scored candidates by type
   */
  private categorizeCandidates(candidates: ScoredCandidate[]): Record<string, ScoredCandidate[]> {
    const categories: Record<string, ScoredCandidate[]> = {
      fact: [],
      entity: [],
      loop: [],
      constraint: [],
      decision: [],
      memory: [],
    };
    
    for (const candidate of candidates) {
      if (categories[candidate.type]) {
        categories[candidate.type].push(candidate);
      } else {
        categories.memory.push(candidate);
      }
    }
    
    return categories;
  }

  /**
   * Build the RunBrief from categorized candidates
   * 
   * Issue #169: Now includes constraint pinning to prevent constraint drift
   */
  private buildBrief(
    runId: string,
    compiledAt: string,
    categorized: Record<string, ScoredCandidate[]>,
    allocated: Record<string, number>,
    totalBudget: number
  ): RunBrief {
    // Issue #169: Get pinned constraints (never drop these)
    const allCandidates = Object.values(categorized).flat();
    const pinnedConstraints = this.getPinnedConstraints(allCandidates);
    const pinnedConstraintIds = new Set(pinnedConstraints.map(c => c.id));
    
    // Convert candidates to brief sections
    const must_know_facts = this.selectFacts(categorized.fact, allocated.must_know_facts);
    
    // Select constraints with pinning protection
    const regularConstraints = categorized.constraint.filter(c => !pinnedConstraintIds.has(c.id));
    
    // Combine pinned + regular constraint candidates (pinned go first)
    const allConstraintCandidates = [...pinnedConstraints, ...regularConstraints];
    const constraints = this.selectConstraintsWithPinned(
      allConstraintCandidates,
      allocated.constraints,
      pinnedConstraintIds
    );
    
    const open_loops = this.selectOpenLoops(categorized.loop, allocated.open_loops);
    const active_state = this.selectEntities(categorized.entity, allocated.active_state);
    const recent_decisions = this.selectDecisions(categorized.decision, allocated.recent_decisions);
    
    // Detect conflicts
    const conflicts = this.detectConflicts([...categorized.fact, ...categorized.memory]);
    
    // Calculate token usage (simplified - would use actual tokenizer)
    const tokenCount = this.estimateTokens([
      ...must_know_facts.map(f => f.content),
      ...constraints.map(c => c.description),
      ...open_loops.map(l => l.description),
      ...Object.values(active_state).map(e => JSON.stringify(e.state)),
      ...recent_decisions.map(d => d.description + d.rationale),
    ]);
    
    return {
      run_id: runId,
      compiled_at: compiledAt,
      must_know_facts,
      active_state,
      open_loops,
      constraints,
      recent_decisions,
      unknowns: [],
      conflicts,
      citations: this.generateCitations(categorized),
      token_count: tokenCount,
      budget_remaining: totalBudget - tokenCount,
    };
  }

  /**
   * Select facts within budget
   */
  private selectFacts(candidates: ScoredCandidate[], budget: number): Fact[] {
    const facts: Fact[] = [];
    let tokens = 0;
    
    for (const c of candidates) {
      const factTokens = this.estimateTokens([c.content]);
      if (tokens + factTokens > budget) break;
      
      facts.push({
        id: c.id,
        content: c.content,
        source: (c.metadata?.source as string) || 'memory',
        importance: c.importance ?? 0.5,
        created_at: c.created_at,
        tags: c.metadata?.tags as string[],
      });
      tokens += factTokens;
    }
    
    return facts;
  }

  /**
   * Select constraints within budget
   */
  private selectConstraints(candidates: ScoredCandidate[], budget: number): Constraint[] {
    const constraints: Constraint[] = [];
    let tokens = 0;
    
    for (const c of candidates) {
      const constraintTokens = this.estimateTokens([c.content]);
      if (tokens + constraintTokens > budget) break;
      
      constraints.push({
        id: c.id,
        type: (c.metadata?.constraint_type as Constraint['type']) || 'custom',
        description: c.content,
        source: (c.metadata?.source as string) || 'system',
        active: true,
      });
      tokens += constraintTokens;
    }
    
    return constraints;
  }

  /**
   * Select constraints with pinned protection (Issue #169)
   * Pinned constraints are always included regardless of budget
   */
  private selectConstraintsWithPinned(
    candidates: ScoredCandidate[],
    budget: number,
    pinnedIds: Set<string>
  ): Constraint[] {
    const constraints: Constraint[] = [];
    let tokens = 0;
    
    if (!candidates || candidates.length === 0) {
      return constraints;
    }
    
    // First pass: include all pinned constraints (ignore budget for pinned)
    const pinnedCandidates = candidates.filter(c => pinnedIds.has(c.id));
    for (const c of pinnedCandidates) {
      if (!c.content) continue;
      
      constraints.push({
        id: c.id,
        type: (c.metadata?.constraint_type as Constraint['type']) || 'custom',
        description: c.content,
        source: (c.metadata?.source as string) || 'system',
        active: true,
      });
      // Note: We count pinned tokens but don't limit them
      tokens += this.estimateTokens([c.content]);
    }
    
    // Second pass: include regular constraints within remaining budget
    const regularCandidates = candidates.filter(c => !pinnedIds.has(c.id));
    const remainingBudget = Math.max(0, budget - tokens);
    
    for (const c of regularCandidates) {
      if (!c.content) continue;
      
      const constraintTokens = this.estimateTokens([c.content]);
      if (tokens + constraintTokens > budget) break;
      
      constraints.push({
        id: c.id,
        type: (c.metadata?.constraint_type as Constraint['type']) || 'custom',
        description: c.content,
        source: (c.metadata?.source as string) || 'system',
        active: true,
      });
      tokens += constraintTokens;
    }
    
    return constraints;
  }

  /**
   * Select open loops within budget
   */
  private selectOpenLoops(candidates: ScoredCandidate[], budget: number): OpenLoop[] {
    const loops: OpenLoop[] = [];
    let tokens = 0;
    
    for (const c of candidates) {
      const loopTokens = this.estimateTokens([c.content]);
      if (tokens + loopTokens > budget) break;
      
      loops.push({
        id: c.id,
        description: c.content,
        priority: (c.metadata?.priority as OpenLoop['priority']) || 'medium',
        created_at: c.created_at,
        due_at: c.metadata?.due_at as string,
        context: c.metadata?.context as string,
      });
      tokens += loopTokens;
    }
    
    return loops;
  }

  /**
   * Select entities within budget
   */
  private selectEntities(candidates: ScoredCandidate[], budget: number): Record<string, Entity> {
    const entities: Record<string, Entity> = {};
    let tokens = 0;
    
    for (const c of candidates) {
      const entityTokens = this.estimateTokens([c.content]);
      if (tokens + entityTokens > budget) break;
      
      entities[c.id] = {
        id: c.id,
        type: (c.metadata?.entity_type as string) || 'unknown',
        name: (c.metadata?.name as string) || c.id,
        state: (c.metadata?.state as Record<string, unknown>) || {},
        updated_at: c.updated_at || c.created_at,
      };
      tokens += entityTokens;
    }
    
    return entities;
  }

  /**
   * Select decisions within budget
   */
  private selectDecisions(candidates: ScoredCandidate[], budget: number): Decision[] {
    const decisions: Decision[] = [];
    let tokens = 0;
    
    for (const c of candidates) {
      const decisionTokens = this.estimateTokens([c.content]);
      if (tokens + decisionTokens > budget) break;
      
      decisions.push({
        id: c.id,
        description: c.content,
        rationale: (c.metadata?.rationale as string) || '',
        made_at: c.created_at,
        confidence: c.trust ?? 0.5,
      });
      tokens += decisionTokens;
    }
    
    return decisions;
  }

  /**
   * Detect conflicts between candidates
   */
  private detectConflicts(candidates: ScoredCandidate[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    // Simple conflict detection - look for similar content with different values
    // In production, would use more sophisticated NLP
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];
        
        // Check for potential conflict (same topic, different content)
        if (this.mightConflict(a, b)) {
          conflicts.push({
            id: randomUUID(),
            description: `Potential conflict between "${a.content.slice(0, 50)}..." and "${b.content.slice(0, 50)}..."`,
            sources: [a.id, b.id],
            conflicting_values: [a.content, b.content],
            detected_at: new Date().toISOString(),
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Check if two candidates might conflict
   */
  private mightConflict(a: ScoredCandidate, b: ScoredCandidate): boolean {
    // Simple heuristic - same type and high word overlap but different content
    if (a.type !== b.type) return false;
    
    const aWords = new Set(a.content.toLowerCase().split(/\s+/));
    const bWords = new Set(b.content.toLowerCase().split(/\s+/));
    
    const intersection = [...aWords].filter(w => bWords.has(w));
    const overlap = intersection.length / Math.min(aWords.size, bWords.size);
    
    // High overlap but not identical suggests potential conflict
    return overlap > 0.5 && overlap < 0.9;
  }

  /**
   * Generate citations for included content
   */
  private generateCitations(categorized: Record<string, ScoredCandidate[]>): Citation[] {
    const citations: Citation[] = [];
    const now = new Date().toISOString();
    
    for (const candidates of Object.values(categorized)) {
      for (const c of candidates.slice(0, 10)) { // Limit citations
        citations.push({
          id: randomUUID(),
          memory_id: c.id,
          source: (c.metadata?.source as string) || 'memory',
          retrieved_at: now,
          relevance_score: c.score,
        });
      }
    }
    
    return citations;
  }

  /**
   * Estimate token count for content
   */
  private estimateTokens(contents: string[]): number {
    // Simple estimation: ~4 characters per token
    const totalChars = contents.reduce((sum, c) => sum + c.length, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Generate explanation trace
   */
  private generateExplanation(
    runId: string,
    compiledAt: string,
    scoredCandidates: ScoredCandidate[],
    brief: RunBrief,
    allocated: Record<string, number>
  ): ExplanationTrace {
    const includedIds = new Set([
      ...brief.must_know_facts.map(f => f.id),
      ...Object.keys(brief.active_state),
      ...brief.open_loops.map(l => l.id),
      ...brief.constraints.map(c => c.id),
      ...brief.recent_decisions.map(d => d.id),
    ]);
    
    const candidates: CandidateExplanation[] = scoredCandidates.map(c => ({
      candidate_id: c.id,
      included: includedIds.has(c.id),
      score: c.score,
      score_breakdown: c.score_breakdown,
      reason: includedIds.has(c.id) 
        ? `Included: score ${c.score.toFixed(3)} above threshold`
        : `Excluded: score ${c.score.toFixed(3)} below threshold or budget exceeded`,
    }));
    
    return {
      run_id: runId,
      compiled_at: compiledAt,
      total_candidates: scoredCandidates.length,
      included_count: includedIds.size,
      excluded_count: scoredCandidates.length - includedIds.size,
      candidates,
      budget_allocation: allocated as ExplanationTrace['budget_allocation'],
    };
  }
}

// Export singleton instance
export const contextCompiler = new ContextCompiler();

// Re-export types for convenience
export { CompileRequest } from './types.js';
