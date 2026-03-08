/**
 * Signal Fitness League - Shadow Evaluator
 * Issue #71: Paired shadow runner for memory fitness evaluation
 *
 * For sampled production prompts, run paired inference:
 * baseline (with memory) vs ablation (without memory)
 */

import { randomUUID } from 'crypto';
import {
  MemoryUnit,
  EvaluationResult,
  QualityMetrics,
  ShadowEvalConfig,
  ObjectivePack,
  DEFAULT_SHADOW_EVAL_CONFIG,
  DEFAULT_OBJECTIVE_PACK,
} from './types.js';

/**
 * Inference provider interface
 * Implementations would connect to actual LLM providers
 */
export interface InferenceProvider {
  /**
   * Run inference with given context
   */
  infer(
    prompt: string,
    context: string[],
    options?: { timeout_ms?: number }
  ): Promise<InferenceResult>;
  
  /**
   * Get current model version
   */
  getModelVersion(): string;
}

/**
 * Result from a single inference call
 */
export interface InferenceResult {
  response: string;
  tokens_used: number;
  latency_ms: number;
  model_version: string;
}

/**
 * Quality judge interface
 * Evaluates response quality using LLM-as-judge or heuristics
 */
export interface QualityJudge {
  /**
   * Score the quality of a response
   */
  score(
    prompt: string,
    response: string,
    reference?: string,
    objectivePack?: ObjectivePack
  ): Promise<QualityMetrics>;
}

/**
 * Simple heuristic-based quality judge
 * In production, this would use LLM-as-judge
 */
export class HeuristicQualityJudge implements QualityJudge {
  async score(
    prompt: string,
    response: string,
    _reference?: string,
    objectivePack: ObjectivePack = DEFAULT_OBJECTIVE_PACK
  ): Promise<QualityMetrics> {
    // Simple heuristics for demo - production would use LLM-as-judge
    const correctness = this.scoreCorrectness(prompt, response);
    const coherence = this.scoreCoherence(response);
    const completeness = this.scoreCompleteness(prompt, response);
    const relevance = this.scoreRelevance(prompt, response);
    
    const aggregate = 
      objectivePack.correctness_weight * correctness +
      objectivePack.coherence_weight * coherence +
      objectivePack.completeness_weight * completeness +
      objectivePack.relevance_weight * relevance;
    
    return {
      correctness,
      coherence,
      completeness,
      relevance,
      aggregate,
    };
  }

  private scoreCorrectness(_prompt: string, response: string): number {
    // Heuristic: longer responses with structure tend to be more correct
    const hasStructure = /(\d+\.|•|-|\*)/g.test(response);
    const hasSubstance = response.length > 50;
    return (hasStructure ? 0.6 : 0.3) + (hasSubstance ? 0.3 : 0.1);
  }

  private scoreCoherence(response: string): number {
    // Heuristic: check for sentence structure
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0.2;
    
    const avgLength = response.length / sentences.length;
    // Ideal sentence length ~50-150 chars
    const lengthScore = avgLength >= 50 && avgLength <= 150 ? 0.8 : 0.5;
    
    return lengthScore;
  }

  private scoreCompleteness(prompt: string, response: string): number {
    // Heuristic: response should address key terms from prompt
    const promptWords = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const responseWords = new Set(response.toLowerCase().split(/\s+/));
    
    const overlap = promptWords.filter(w => responseWords.has(w)).length;
    const coverage = promptWords.length > 0 ? overlap / promptWords.length : 0;
    
    return Math.min(1, coverage + 0.3);
  }

  private scoreRelevance(prompt: string, response: string): number {
    // Heuristic: keyword overlap
    const promptWords = new Set(prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const responseWords = response.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    const relevant = responseWords.filter(w => promptWords.has(w)).length;
    const ratio = responseWords.length > 0 ? relevant / responseWords.length : 0;
    
    return Math.min(1, ratio + 0.3);
  }
}

/**
 * Evaluation request
 */
export interface EvaluationRequest {
  prompt_id: string;
  prompt: string;
  memory: MemoryUnit;
  context: string[];      // Other context to include
  reference?: string;     // Reference answer for quality scoring
}

/**
 * Shadow Evaluator - Runs paired inference for fitness measurement
 */
export class ShadowEvaluator {
  private config: ShadowEvalConfig;
  private provider: InferenceProvider;
  private judge: QualityJudge;
  private objectivePack: ObjectivePack;
  
  // Rate limiting
  private evalCounts: Map<string, { date: string; count: number }> = new Map();

  constructor(
    provider: InferenceProvider,
    judge?: QualityJudge,
    config: Partial<ShadowEvalConfig> = {},
    objectivePack: ObjectivePack = DEFAULT_OBJECTIVE_PACK
  ) {
    this.config = { ...DEFAULT_SHADOW_EVAL_CONFIG, ...config };
    this.provider = provider;
    this.judge = judge ?? new HeuristicQualityJudge();
    this.objectivePack = objectivePack;
  }

  /**
   * Check if a prompt should be sampled for evaluation
   */
  shouldSample(): boolean {
    return Math.random() < this.config.sample_rate;
  }

  /**
   * Check if a memory can be evaluated (rate limiting)
   */
  canEvaluate(memoryId: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    const record = this.evalCounts.get(memoryId);
    
    if (!record || record.date !== today) {
      return true;
    }
    
    return record.count < this.config.max_evals_per_memory_daily;
  }

  /**
   * Record an evaluation for rate limiting
   */
  private recordEvaluation(memoryId: string): void {
    const today = new Date().toISOString().split('T')[0];
    const record = this.evalCounts.get(memoryId);
    
    if (!record || record.date !== today) {
      this.evalCounts.set(memoryId, { date: today, count: 1 });
    } else {
      record.count++;
    }
  }

  /**
   * Run paired evaluation: baseline vs ablation
   */
  async evaluate(request: EvaluationRequest): Promise<EvaluationResult> {
    const { prompt_id, prompt, memory, context, reference } = request;
    
    if (!this.canEvaluate(memory.id)) {
      throw new Error(`Rate limit exceeded for memory ${memory.id}`);
    }
    
    const modelVersion = this.provider.getModelVersion();
    
    // Build contexts
    const baselineContext = [...context, memory.content];
    const ablationContext = [...context]; // Without the memory
    
    // Run baseline inference (with memory)
    const baselineResult = await this.provider.infer(
      prompt,
      baselineContext,
      { timeout_ms: this.config.inference_timeout_ms }
    );
    
    // Run ablation inference (without memory)
    const ablationResult = await this.provider.infer(
      prompt,
      ablationContext,
      { timeout_ms: this.config.inference_timeout_ms }
    );
    
    // Score quality if enabled
    let baselineQuality: QualityMetrics;
    let ablationQuality: QualityMetrics;
    
    if (this.config.enable_quality_scoring) {
      [baselineQuality, ablationQuality] = await Promise.all([
        this.judge.score(prompt, baselineResult.response, reference, this.objectivePack),
        this.judge.score(prompt, ablationResult.response, reference, this.objectivePack),
      ]);
    } else {
      // Default neutral quality
      baselineQuality = { correctness: 0.5, coherence: 0.5, completeness: 0.5, relevance: 0.5, aggregate: 0.5 };
      ablationQuality = { correctness: 0.5, coherence: 0.5, completeness: 0.5, relevance: 0.5, aggregate: 0.5 };
    }
    
    // Calculate deltas
    const deltaQuality = baselineQuality.aggregate - ablationQuality.aggregate;
    const deltaTokens = baselineResult.tokens_used - ablationResult.tokens_used;
    const deltaLatency = baselineResult.latency_ms - ablationResult.latency_ms;
    
    // Record evaluation
    this.recordEvaluation(memory.id);
    
    return {
      id: randomUUID(),
      memory_id: memory.id,
      prompt_id,
      model_version: modelVersion,
      evaluated_at: new Date().toISOString(),
      baseline_quality: baselineQuality,
      baseline_tokens: baselineResult.tokens_used,
      baseline_latency_ms: baselineResult.latency_ms,
      ablation_quality: ablationQuality,
      ablation_tokens: ablationResult.tokens_used,
      ablation_latency_ms: ablationResult.latency_ms,
      delta_quality: deltaQuality,
      delta_tokens: deltaTokens,
      delta_latency_ms: deltaLatency,
    };
  }

  /**
   * Run batch evaluation for multiple memories
   */
  async evaluateBatch(
    prompt_id: string,
    prompt: string,
    memories: MemoryUnit[],
    baseContext: string[] = [],
    reference?: string
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];
    
    for (const memory of memories) {
      if (!this.canEvaluate(memory.id)) {
        continue;
      }
      
      try {
        const result = await this.evaluate({
          prompt_id,
          prompt,
          memory,
          context: baseContext,
          reference,
        });
        results.push(result);
      } catch (error) {
        // Log error but continue with other memories
        console.error(`Evaluation failed for memory ${memory.id}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Get current configuration
   */
  getConfig(): ShadowEvalConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ShadowEvalConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get evaluation counts for today
   */
  getTodaysCounts(): Map<string, number> {
    const today = new Date().toISOString().split('T')[0];
    const counts = new Map<string, number>();
    
    for (const [memoryId, record] of this.evalCounts) {
      if (record.date === today) {
        counts.set(memoryId, record.count);
      }
    }
    
    return counts;
  }

  /**
   * Reset evaluation counts (for testing)
   */
  resetCounts(): void {
    this.evalCounts.clear();
  }
}

/**
 * Mock inference provider for testing
 */
export class MockInferenceProvider implements InferenceProvider {
  private modelVersion: string;
  private baseLatency: number;
  private tokensPerChar: number;

  constructor(
    modelVersion = 'mock-v1',
    baseLatency = 100,
    tokensPerChar = 0.25
  ) {
    this.modelVersion = modelVersion;
    this.baseLatency = baseLatency;
    this.tokensPerChar = tokensPerChar;
  }

  async infer(
    prompt: string,
    context: string[],
    _options?: { timeout_ms?: number }
  ): Promise<InferenceResult> {
    // Simulate latency proportional to context size
    const contextSize = context.join(' ').length;
    const latency = this.baseLatency + Math.floor(contextSize * 0.1);
    
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
    
    // Generate mock response
    const response = `This is a mock response to: "${prompt.substring(0, 50)}..." with ${context.length} context items.`;
    
    return {
      response,
      tokens_used: Math.ceil((prompt.length + contextSize + response.length) * this.tokensPerChar),
      latency_ms: latency,
      model_version: this.modelVersion,
    };
  }

  getModelVersion(): string {
    return this.modelVersion;
  }
}
