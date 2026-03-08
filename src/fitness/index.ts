/**
 * Signal Fitness League - Memory Optimization Engine
 * Issue #71: Continuous ranking loop to optimize memory retention
 *
 * A production-grounded system that:
 * - Tracks memory units with metadata
 * - Runs shadow evaluations to measure marginal utility
 * - Scores fitness based on quality/token/latency impact
 * - Promotes/demotes memories based on policy thresholds
 * - Preserves rare high-impact knowledge via guardrails
 */

// Export all types
export * from './types.js';

// Export registry
export {
  MemoryRegistry,
  type RegistryEntry,
  type RegisterOptions,
  type QueryOptions,
} from './registry.js';

// Export evaluator
export {
  ShadowEvaluator,
  MockInferenceProvider,
  HeuristicQualityJudge,
  type InferenceProvider,
  type InferenceResult,
  type QualityJudge,
  type EvaluationRequest,
} from './evaluator.js';

// Export scorer
export {
  FitnessScorer,
  quickScore,
  aggregateQuickScores,
  type ScoringOptions,
} from './scorer.js';

// Export policy engine
export {
  PolicyEngine,
  dryRunEvaluation,
  type DecisionType,
  type PendingDecision,
  type PolicyExecutionResult,
} from './policy.js';

// ─── High-Level API ───────────────────────────────────────────

import {
  FitnessLeagueConfig,
  DEFAULT_FITNESS_LEAGUE_CONFIG,
  EvaluationResult,
  FitnessScore,
  PolicyDecision,
  DashboardMetrics,
  MemoryUnit,
} from './types.js';
import { MemoryRegistry, RegistryEntry, RegisterOptions } from './registry.js';
import { ShadowEvaluator, InferenceProvider, QualityJudge } from './evaluator.js';
import { FitnessScorer } from './scorer.js';
import { PolicyEngine, PolicyExecutionResult } from './policy.js';

/**
 * Fitness League - Main orchestrator for memory optimization
 *
 * Usage:
 * ```typescript
 * const league = new FitnessLeague(inferenceProvider);
 *
 * // Register memories
 * const memory = league.register({
 *   content: 'User prefers dark mode',
 *   source: 'user',
 *   topic: 'preferences',
 *   intent_tags: ['preference'],
 * });
 *
 * // Run evaluations (typically called from production traffic sampling)
 * const result = await league.evaluate(promptId, prompt, memory);
 *
 * // Apply policy (typically called periodically)
 * const decisions = league.applyPolicy();
 *
 * // Get dashboard metrics
 * const metrics = league.getDashboard();
 * ```
 */
export class FitnessLeague {
  private config: FitnessLeagueConfig;
  private registry: MemoryRegistry;
  private evaluator: ShadowEvaluator;
  private scorer: FitnessScorer;
  private policyEngine: PolicyEngine;
  
  // Evaluation results cache (in production, this would be persisted)
  private evaluationResults: Map<string, EvaluationResult[]> = new Map();

  constructor(
    inferenceProvider: InferenceProvider,
    qualityJudge?: QualityJudge,
    config: Partial<FitnessLeagueConfig> = {}
  ) {
    this.config = { ...DEFAULT_FITNESS_LEAGUE_CONFIG, ...config };
    
    this.registry = new MemoryRegistry(this.config.protected_ids);
    this.evaluator = new ShadowEvaluator(
      inferenceProvider,
      qualityJudge,
      this.config.shadow_eval
    );
    this.scorer = new FitnessScorer({ weights: this.config.weights });
    this.policyEngine = new PolicyEngine(this.registry, this.config.thresholds);
  }

  // ─── Memory Management ────────────────────────────────────────

  /**
   * Register a new memory unit
   */
  register(options: RegisterOptions): MemoryUnit {
    return this.registry.register(options);
  }

  /**
   * Get a memory by ID
   */
  get(id: string): RegistryEntry | undefined {
    return this.registry.get(id);
  }

  /**
   * Get active memories for context selection
   */
  getActiveMemories(): MemoryUnit[] {
    return this.registry.getActiveMemories();
  }

  /**
   * Access a memory (records access and returns content)
   */
  access(id: string): MemoryUnit | undefined {
    return this.registry.access(id);
  }

  /**
   * Update memory content
   */
  update(id: string, content: string, embedding?: number[]): MemoryUnit | undefined {
    return this.registry.update(id, content, embedding);
  }

  /**
   * Protect a memory from auto-demotion
   */
  protect(id: string): void {
    this.policyEngine.manualProtect(id, 'User-requested protection');
  }

  /**
   * Unprotect a memory
   */
  unprotect(id: string): void {
    this.policyEngine.manualUnprotect(id, 'User-requested unprotection');
  }

  // ─── Evaluation ───────────────────────────────────────────────

  /**
   * Check if a prompt should be sampled for evaluation
   */
  shouldSample(): boolean {
    return this.evaluator.shouldSample();
  }

  /**
   * Run evaluation for a memory
   */
  async evaluate(
    promptId: string,
    prompt: string,
    memory: MemoryUnit,
    context: string[] = []
  ): Promise<EvaluationResult> {
    const result = await this.evaluator.evaluate({
      prompt_id: promptId,
      prompt,
      memory,
      context,
    });
    
    // Store result
    const existing = this.evaluationResults.get(memory.id) ?? [];
    existing.push(result);
    this.evaluationResults.set(memory.id, existing);
    
    // Update fitness score
    this.updateFitnessScore(memory.id);
    
    // Record success/failure for consecutive tracking
    if (result.delta_quality > 0) {
      this.registry.recordSuccess(memory.id);
    } else if (result.delta_quality < 0) {
      this.registry.recordFailure(memory.id);
    }
    
    return result;
  }

  /**
   * Get fitness score for a memory
   */
  getFitnessScore(id: string): FitnessScore | undefined {
    return this.registry.get(id)?.fitness_score;
  }

  /**
   * Recalculate fitness score for a memory
   */
  private updateFitnessScore(id: string): FitnessScore {
    const evaluations = this.evaluationResults.get(id) ?? [];
    const rarity = this.registry.analyzeRarity(id);
    const score = this.scorer.calculate(id, evaluations, rarity);
    this.registry.updateFitnessScore(id, score);
    return score;
  }

  /**
   * Get all evaluation results for a memory
   */
  getEvaluations(id: string): EvaluationResult[] {
    return this.evaluationResults.get(id) ?? [];
  }

  // ─── Policy ───────────────────────────────────────────────────

  /**
   * Apply policy to all memories
   * Returns executed decisions
   */
  applyPolicy(): PolicyExecutionResult {
    if (!this.config.auto_policy) {
      throw new Error('Automatic policy is disabled. Use manualPromote/manualDemote instead.');
    }
    
    // Collect all fitness scores
    const fitnessScores = new Map<string, FitnessScore>();
    for (const entry of this.registry.export()) {
      if (entry.fitness_score) {
        fitnessScores.set(entry.memory.id, entry.fitness_score);
      }
    }
    
    // Evaluate all
    const decisions = this.policyEngine.evaluateAll(fitnessScores);
    
    // Execute non-maintain decisions
    return this.policyEngine.executeAll(decisions);
  }

  /**
   * Dry run policy evaluation (no side effects)
   */
  dryRunPolicy(): import('./policy.js').PendingDecision[] {
    const fitnessScores = new Map<string, FitnessScore>();
    for (const entry of this.registry.export()) {
      if (entry.fitness_score) {
        fitnessScores.set(entry.memory.id, entry.fitness_score);
      }
    }
    
    return this.policyEngine.evaluateAll(fitnessScores);
  }

  /**
   * Manual promote
   */
  manualPromote(id: string, reason: string): PolicyDecision {
    return this.policyEngine.manualPromote(id, reason);
  }

  /**
   * Manual demote
   */
  manualDemote(id: string, reason: string): PolicyDecision {
    return this.policyEngine.manualDemote(id, reason);
  }

  /**
   * Get policy audit log
   */
  getAuditLog(limit?: number): PolicyDecision[] {
    return this.policyEngine.getAuditLog(limit);
  }

  // ─── Dashboard ────────────────────────────────────────────────

  /**
   * Get dashboard metrics
   */
  getDashboard(): DashboardMetrics {
    const stats = this.registry.getStats();
    const entries = this.registry.export();
    
    // Top performers (by fitness)
    const scoredEntries = entries
      .filter(e => e.fitness_score)
      .sort((a, b) => (b.fitness_score?.fitness ?? 0) - (a.fitness_score?.fitness ?? 0));
    
    const topFitness = scoredEntries.slice(0, 10).map(e => ({
      memory_id: e.memory.id,
      fitness: e.fitness_score!.fitness,
      topic: e.memory.topic,
    }));
    
    // At risk (low fitness, many consecutive failures)
    const atRisk = this.registry.getAtRisk(this.config.thresholds.consecutive_failures_demote - 1)
      .slice(0, 10)
      .map(e => ({
        memory_id: e.memory.id,
        fitness: e.fitness_score?.fitness ?? 0,
        consecutive_failures: e.consecutive_failures,
      }));
    
    // Recent decisions
    const recentDecisions = this.policyEngine.getAuditLog(10);
    
    // Calculate efficiency metrics
    const activeTokens = stats.active_tokens;
    const totalTokens = stats.total_tokens;
    const tokenReduction = totalTokens > 0 ? ((totalTokens - activeTokens) / totalTokens) * 100 : 0;
    
    // Average quality delta
    const allEvals = Array.from(this.evaluationResults.values()).flat();
    const avgQualityDelta = allEvals.length > 0
      ? allEvals.reduce((sum, e) => sum + e.delta_quality, 0) / allEvals.length
      : 0;
    
    // Average latency delta
    const avgLatencyDelta = allEvals.length > 0
      ? allEvals.reduce((sum, e) => sum + e.delta_latency_ms, 0) / allEvals.length
      : 0;
    
    return {
      timestamp: new Date().toISOString(),
      registry_stats: stats,
      top_fitness: topFitness,
      at_risk: atRisk,
      recent_decisions: recentDecisions,
      token_reduction_percent: tokenReduction,
      quality_delta: avgQualityDelta,
      latency_delta_ms: avgLatencyDelta,
    };
  }

  // ─── Configuration ────────────────────────────────────────────

  /**
   * Get current configuration
   */
  getConfig(): FitnessLeagueConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<FitnessLeagueConfig>): void {
    this.config = { ...this.config, ...updates };
    
    if (updates.weights) {
      this.scorer.updateOptions({ weights: updates.weights });
    }
    if (updates.thresholds) {
      this.policyEngine.updateThresholds(updates.thresholds);
    }
    if (updates.shadow_eval) {
      this.evaluator.updateConfig(updates.shadow_eval);
    }
  }

  /**
   * Enable automatic policy
   */
  enableAutoPolicy(): void {
    this.config.auto_policy = true;
  }

  /**
   * Disable automatic policy
   */
  disableAutoPolicy(): void {
    this.config.auto_policy = false;
  }

  // ─── Export/Import ────────────────────────────────────────────

  /**
   * Export all state
   */
  export(): {
    config: FitnessLeagueConfig;
    registry: RegistryEntry[];
    evaluations: Record<string, EvaluationResult[]>;
    auditLog: PolicyDecision[];
  } {
    return {
      config: this.config,
      registry: this.registry.export(),
      evaluations: Object.fromEntries(this.evaluationResults),
      auditLog: this.policyEngine.getAuditLog(),
    };
  }

  /**
   * Import state
   */
  import(state: {
    config?: Partial<FitnessLeagueConfig>;
    registry?: RegistryEntry[];
    evaluations?: Record<string, EvaluationResult[]>;
    auditLog?: string;
  }): void {
    if (state.config) {
      this.updateConfig(state.config);
    }
    if (state.registry) {
      this.registry.import(state.registry);
    }
    if (state.evaluations) {
      for (const [id, evals] of Object.entries(state.evaluations)) {
        this.evaluationResults.set(id, evals);
      }
    }
    if (state.auditLog) {
      this.policyEngine.importAuditLog(state.auditLog);
    }
  }

  /**
   * Clear all state (for testing)
   */
  clear(): void {
    this.registry.clear();
    this.evaluationResults.clear();
    this.policyEngine.clearAuditLog();
  }

  // ─── Registry Access ──────────────────────────────────────────

  /**
   * Get registry size
   */
  get size(): number {
    return this.registry.size;
  }

  /**
   * Get registry stats
   */
  getStats(): import('./types.js').RegistryStats {
    return this.registry.getStats();
  }
}
