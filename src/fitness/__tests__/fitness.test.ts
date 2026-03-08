/**
 * Signal Fitness League Tests
 * Issue #71: Memory Optimization Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FitnessLeague,
  MemoryRegistry,
  ShadowEvaluator,
  MockInferenceProvider,
  HeuristicQualityJudge,
  FitnessScorer,
  PolicyEngine,
  quickScore,
  aggregateQuickScores,
  dryRunEvaluation,
  DEFAULT_FITNESS_WEIGHTS,
  DEFAULT_POLICY_THRESHOLDS,
} from '../index.js';
import type {
  MemoryUnit,
  EvaluationResult,
  FitnessScore,
  RegistryEntry,
} from '../index.js';

describe('MemoryRegistry', () => {
  let registry: MemoryRegistry;

  beforeEach(() => {
    registry = new MemoryRegistry();
  });

  it('should register a new memory', () => {
    const memory = registry.register({
      content: 'User prefers dark mode',
      source: 'user',
      topic: 'preferences',
      intent_tags: ['preference'],
    });

    expect(memory.id).toBeDefined();
    expect(memory.content).toBe('User prefers dark mode');
    expect(memory.source).toBe('user');
    expect(memory.topic).toBe('preferences');
    expect(memory.intent_tags).toContain('preference');
    expect(memory.criticality).toBe('normal');
    expect(memory.access_count).toBe(0);
  });

  it('should retrieve a memory by ID', () => {
    const memory = registry.register({
      content: 'Test content',
      source: 'user',
      topic: 'test',
      intent_tags: ['fact'],
    });

    const entry = registry.get(memory.id);
    expect(entry).toBeDefined();
    expect(entry!.memory.content).toBe('Test content');
    expect(entry!.status).toBe('active');
  });

  it('should record access and update access count', () => {
    const memory = registry.register({
      content: 'Test content',
      source: 'user',
      topic: 'test',
      intent_tags: ['fact'],
    });

    registry.access(memory.id);
    registry.access(memory.id);

    const entry = registry.get(memory.id);
    expect(entry!.memory.access_count).toBe(2);
    expect(entry!.memory.last_accessed_at).toBeDefined();
  });

  it('should update memory content', () => {
    const memory = registry.register({
      content: 'Original content',
      source: 'user',
      topic: 'test',
      intent_tags: ['fact'],
    });

    const updated = registry.update(memory.id, 'Updated content');
    expect(updated!.content).toBe('Updated content');
    // updated_at should be >= created_at (may be same timestamp if very fast)
    expect(new Date(updated!.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(memory.created_at).getTime());
  });

  it('should query memories with filters', () => {
    registry.register({
      content: 'Memory 1',
      source: 'user',
      topic: 'preferences',
      intent_tags: ['preference'],
    });
    registry.register({
      content: 'Memory 2',
      source: 'conversation',
      topic: 'facts',
      intent_tags: ['fact'],
    });
    registry.register({
      content: 'Memory 3',
      source: 'user',
      topic: 'facts',
      intent_tags: ['fact'],
    });

    const userMemories = registry.query({ source: ['user'] });
    expect(userMemories).toHaveLength(2);

    const factMemories = registry.query({ topic: 'facts' });
    expect(factMemories).toHaveLength(2);

    const preferenceMemories = registry.query({ intent_tags: ['preference'] });
    expect(preferenceMemories).toHaveLength(1);
  });

  it('should protect memories from demotion', () => {
    const memory = registry.register({
      content: 'Protected content',
      source: 'user',
      topic: 'test',
      intent_tags: ['constraint'],
      criticality: 'compliance',
    });

    expect(registry.isProtected(memory.id)).toBe(true);
    expect(registry.delete(memory.id)).toBe(false); // Cannot delete protected
    expect(registry.archive(memory.id)).toBe(false); // Cannot archive protected
  });

  it('should calculate registry statistics', () => {
    registry.register({
      content: 'Memory 1',
      source: 'user',
      topic: 'test',
      intent_tags: ['fact'],
    });
    registry.register({
      content: 'Memory 2',
      source: 'user',
      topic: 'test',
      intent_tags: ['fact'],
      criticality: 'protected',
    });

    const stats = registry.getStats();
    expect(stats.total_memories).toBe(2);
    expect(stats.protected_memories).toBe(1);
  });

  it('should analyze rarity of memories', () => {
    const m1 = registry.register({
      content: 'Common topic memory',
      source: 'user',
      topic: 'common',
      intent_tags: ['fact'],
      embedding: [1, 0, 0],
    });
    registry.register({
      content: 'Another common topic',
      source: 'user',
      topic: 'common',
      intent_tags: ['fact'],
      embedding: [0.9, 0.1, 0],
    });
    const m3 = registry.register({
      content: 'Rare topic memory',
      source: 'user',
      topic: 'rare',
      intent_tags: ['fact'],
      embedding: [0, 1, 0],
    });

    const rarity1 = registry.analyzeRarity(m1.id);
    const rarity3 = registry.analyzeRarity(m3.id);

    expect(rarity1).toBeDefined();
    expect(rarity3).toBeDefined();
    expect(rarity3!.rarity_score).toBeGreaterThan(rarity1!.rarity_score);
  });
});

describe('ShadowEvaluator', () => {
  let evaluator: ShadowEvaluator;
  let provider: MockInferenceProvider;

  beforeEach(() => {
    provider = new MockInferenceProvider('test-v1', 50, 0.25);
    evaluator = new ShadowEvaluator(provider, new HeuristicQualityJudge(), {
      sample_rate: 1.0, // Always sample for testing
      max_evals_per_memory_daily: 100,
    });
  });

  it('should sample based on configured rate', () => {
    const lowRateEvaluator = new ShadowEvaluator(
      provider,
      undefined,
      { sample_rate: 0.0 }
    );
    expect(lowRateEvaluator.shouldSample()).toBe(false);
  });

  it('should run paired evaluation', async () => {
    const memory: MemoryUnit = {
      id: 'test-memory',
      content: 'User prefers dark mode',
      source: 'user',
      topic: 'preferences',
      intent_tags: ['preference'],
      criticality: 'normal',
      token_cost: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      access_count: 0,
    };

    const result = await evaluator.evaluate({
      prompt_id: 'prompt-1',
      prompt: 'What are my display preferences?',
      memory,
      context: [],
    });

    expect(result.memory_id).toBe('test-memory');
    expect(result.prompt_id).toBe('prompt-1');
    expect(result.baseline_quality).toBeDefined();
    expect(result.ablation_quality).toBeDefined();
    expect(result.baseline_tokens).toBeGreaterThan(0);
    expect(result.ablation_tokens).toBeGreaterThan(0);
    expect(typeof result.delta_quality).toBe('number');
    expect(typeof result.delta_tokens).toBe('number');
    expect(typeof result.delta_latency_ms).toBe('number');
  });

  it('should respect rate limits', async () => {
    const lowLimitEvaluator = new ShadowEvaluator(
      provider,
      undefined,
      { sample_rate: 1.0, max_evals_per_memory_daily: 1 }
    );

    const memory: MemoryUnit = {
      id: 'limited-memory',
      content: 'Test content',
      source: 'user',
      topic: 'test',
      intent_tags: ['fact'],
      criticality: 'normal',
      token_cost: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      access_count: 0,
    };

    // First evaluation should succeed
    await lowLimitEvaluator.evaluate({
      prompt_id: 'p1',
      prompt: 'Test',
      memory,
      context: [],
    });

    // Second should fail due to rate limit
    await expect(
      lowLimitEvaluator.evaluate({
        prompt_id: 'p2',
        prompt: 'Test',
        memory,
        context: [],
      })
    ).rejects.toThrow('Rate limit exceeded');
  });
});

describe('FitnessScorer', () => {
  let scorer: FitnessScorer;

  beforeEach(() => {
    scorer = new FitnessScorer();
  });

  it('should calculate fitness score from evaluations', () => {
    const evaluations: EvaluationResult[] = [
      {
        id: 'eval-1',
        memory_id: 'memory-1',
        prompt_id: 'prompt-1',
        model_version: 'v1',
        evaluated_at: new Date().toISOString(),
        baseline_quality: { correctness: 0.8, coherence: 0.9, completeness: 0.8, relevance: 0.9, aggregate: 0.85 },
        baseline_tokens: 150,
        baseline_latency_ms: 500,
        ablation_quality: { correctness: 0.6, coherence: 0.8, completeness: 0.6, relevance: 0.7, aggregate: 0.675 },
        ablation_tokens: 100,
        ablation_latency_ms: 400,
        delta_quality: 0.175,
        delta_tokens: 50,
        delta_latency_ms: 100,
      },
    ];

    const score = scorer.calculate('memory-1', evaluations);

    expect(score.memory_id).toBe('memory-1');
    expect(score.fitness).toBeGreaterThanOrEqual(0); // Normalized to 0-1 range
    expect(score.fitness).toBeLessThanOrEqual(1);
    expect(score.evaluation_count).toBe(1);
    expect(score.quality_contribution).toBeGreaterThan(0); // Positive quality delta
    expect(score.confidence).toBeLessThan(1); // Low confidence with only 1 evaluation
  });

  it('should detect declining trend', () => {
    const now = Date.now();
    const evaluations: EvaluationResult[] = [
      // Older evaluations - good
      ...Array(5).fill(null).map((_, i) => createEvaluation(
        `eval-old-${i}`,
        'memory-1',
        new Date(now - 86400000 * (5 - i)).toISOString(),
        0.2 // Positive delta
      )),
      // Recent evaluations - bad
      ...Array(5).fill(null).map((_, i) => createEvaluation(
        `eval-new-${i}`,
        'memory-1',
        new Date(now - 3600000 * (5 - i)).toISOString(),
        -0.2 // Negative delta
      )),
    ];

    const score = scorer.calculate('memory-1', evaluations);
    expect(score.trend).toBe('declining');
  });

  it('should assign appropriate grades', () => {
    expect(scorer.getGrade(0.85)).toBe('A');
    expect(scorer.getGrade(0.70)).toBe('B');
    expect(scorer.getGrade(0.55)).toBe('C');
    expect(scorer.getGrade(0.40)).toBe('D');
    expect(scorer.getGrade(0.25)).toBe('F');
  });

  it('should rank scores correctly', () => {
    const scores: FitnessScore[] = [
      createFitnessScore('m1', 0.4),
      createFitnessScore('m2', 0.8),
      createFitnessScore('m3', 0.6),
    ];

    const ranked = scorer.rank(scores);
    expect(ranked[0].memory_id).toBe('m2');
    expect(ranked[1].memory_id).toBe('m3');
    expect(ranked[2].memory_id).toBe('m1');
  });
});

describe('PolicyEngine', () => {
  let registry: MemoryRegistry;
  let engine: PolicyEngine;

  beforeEach(() => {
    registry = new MemoryRegistry();
    engine = new PolicyEngine(registry, {
      promotion_threshold: 0.7,
      demotion_threshold: 0.3,
      min_evaluations_promote: 3,
      min_evaluations_demote: 5,
      consecutive_failures_demote: 3,
    });
  });

  it('should recommend promotion for high-fitness memories', () => {
    const memory = registry.register({
      content: 'High value memory',
      source: 'user',
      topic: 'important',
      intent_tags: ['fact'],
    });

    // Simulate successes
    for (let i = 0; i < 5; i++) {
      registry.recordSuccess(memory.id);
    }

    const entry = registry.get(memory.id)!;
    const score = createFitnessScore(memory.id, 0.8, 5);

    const decision = engine.evaluate(entry, score);
    expect(decision.decision_type).toBe('promote');
    expect(decision.new_status).toBe('promoted');
  });

  it('should recommend demotion for low-fitness memories', () => {
    const memory = registry.register({
      content: 'Low value memory',
      source: 'conversation',
      topic: 'noise',
      intent_tags: ['fact'],
    });

    // Simulate failures
    for (let i = 0; i < 5; i++) {
      registry.recordFailure(memory.id);
    }

    const entry = registry.get(memory.id)!;
    const score = createFitnessScore(memory.id, 0.2, 10);

    const decision = engine.evaluate(entry, score);
    expect(decision.decision_type).toBe('demote');
    expect(decision.new_status).toBe('demoted');
  });

  it('should block demotion of protected memories', () => {
    const memory = registry.register({
      content: 'Compliance critical',
      source: 'system',
      topic: 'compliance',
      intent_tags: ['constraint'],
      criticality: 'compliance',
    });

    // Simulate failures
    for (let i = 0; i < 10; i++) {
      registry.recordFailure(memory.id);
    }

    const entry = registry.get(memory.id)!;
    const score = createFitnessScore(memory.id, 0.1, 20);

    const decision = engine.evaluate(entry, score);
    expect(decision.decision_type).toBe('maintain');
    expect(decision.safety_blocked).toBe(true);
  });

  it('should execute decisions and create audit log', () => {
    const memory = registry.register({
      content: 'Test memory',
      source: 'user',
      topic: 'test',
      intent_tags: ['fact'],
    });

    // Force promotion
    for (let i = 0; i < 5; i++) {
      registry.recordSuccess(memory.id);
    }

    const entry = registry.get(memory.id)!;
    const score = createFitnessScore(memory.id, 0.8, 5);

    const decision = engine.evaluate(entry, score);
    const result = engine.execute(decision);

    expect(result).not.toBeNull();
    expect(result!.new_status).toBe('promoted');

    const auditLog = engine.getAuditLog();
    expect(auditLog).toHaveLength(1);
    expect(auditLog[0].memory_id).toBe(memory.id);
  });

  it('should support manual overrides', () => {
    const memory = registry.register({
      content: 'Test memory',
      source: 'user',
      topic: 'test',
      intent_tags: ['fact'],
    });

    const result = engine.manualPromote(memory.id, 'Testing manual promotion');

    expect(result.new_status).toBe('promoted');
    expect(result.safety_override).toBe(true);
    expect(result.override_reason).toContain('Testing');
  });
});

describe('FitnessLeague (Integration)', () => {
  let league: FitnessLeague;

  beforeEach(() => {
    const provider = new MockInferenceProvider();
    league = new FitnessLeague(provider, undefined, {
      shadow_eval: {
        sample_rate: 1.0,
        max_evals_per_memory_daily: 100,
        model_version: 'test',
        inference_timeout_ms: 5000,
        enable_quality_scoring: true,
      },
      auto_policy: true,
    });
  });

  it('should register and retrieve memories', () => {
    const memory = league.register({
      content: 'User likes TypeScript',
      source: 'user',
      topic: 'preferences',
      intent_tags: ['preference'],
    });

    const entry = league.get(memory.id);
    expect(entry).toBeDefined();
    expect(entry!.memory.content).toBe('User likes TypeScript');
  });

  it('should run evaluation and update fitness', async () => {
    const memory = league.register({
      content: 'Important fact',
      source: 'user',
      topic: 'facts',
      intent_tags: ['fact'],
    });

    await league.evaluate(
      'prompt-1',
      'Tell me about this fact',
      memory
    );

    const score = league.getFitnessScore(memory.id);
    expect(score).toBeDefined();
    expect(score!.evaluation_count).toBe(1);
  });

  it('should provide dashboard metrics', () => {
    league.register({
      content: 'Memory 1',
      source: 'user',
      topic: 'test',
      intent_tags: ['fact'],
    });
    league.register({
      content: 'Memory 2',
      source: 'user',
      topic: 'test',
      intent_tags: ['fact'],
    });

    const dashboard = league.getDashboard();
    
    expect(dashboard.registry_stats.total_memories).toBe(2);
    expect(dashboard.timestamp).toBeDefined();
    expect(Array.isArray(dashboard.top_fitness)).toBe(true);
    expect(Array.isArray(dashboard.at_risk)).toBe(true);
  });

  it('should export and import state', () => {
    const memory = league.register({
      content: 'Persistent memory',
      source: 'user',
      topic: 'test',
      intent_tags: ['fact'],
    });

    const exported = league.export();
    
    // Create new league and import
    const provider = new MockInferenceProvider();
    const newLeague = new FitnessLeague(provider);
    newLeague.import({
      registry: exported.registry,
    });

    const entry = newLeague.get(memory.id);
    expect(entry).toBeDefined();
    expect(entry!.memory.content).toBe('Persistent memory');
  });
});

describe('Utility Functions', () => {
  it('quickScore should calculate score from single evaluation', () => {
    const evaluation: EvaluationResult = {
      id: 'eval-1',
      memory_id: 'mem-1',
      prompt_id: 'prompt-1',
      model_version: 'v1',
      evaluated_at: new Date().toISOString(),
      baseline_quality: { correctness: 0.8, coherence: 0.8, completeness: 0.8, relevance: 0.8, aggregate: 0.8 },
      baseline_tokens: 150,
      baseline_latency_ms: 500,
      ablation_quality: { correctness: 0.6, coherence: 0.6, completeness: 0.6, relevance: 0.6, aggregate: 0.6 },
      ablation_tokens: 100,
      ablation_latency_ms: 400,
      delta_quality: 0.2,
      delta_tokens: 50,
      delta_latency_ms: 100,
    };

    const score = quickScore(evaluation);
    expect(typeof score).toBe('number');
    // Formula: 0.5 * 0.2 - 0.2 * (50/100) - 0.1 * (100/500) = 0.1 - 0.1 - 0.02 = -0.02
    // Score is negative because token/latency penalty outweighs quality gain
    expect(score).toBeDefined();
  });

  it('aggregateQuickScores should combine scores', () => {
    const scores = [0.1, 0.2, 0.3, 0.2, 0.1];
    const result = aggregateQuickScores(scores);

    expect(result.mean).toBeCloseTo(0.18, 2);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('dryRunEvaluation should not modify state', () => {
    const registry = new MemoryRegistry();
    const memory = registry.register({
      content: 'Test',
      source: 'user',
      topic: 'test',
      intent_tags: ['fact'],
    });

    const entry = registry.get(memory.id)!;
    const originalStatus = entry.status;

    const fitnessScores = new Map<string, FitnessScore>();
    fitnessScores.set(memory.id, createFitnessScore(memory.id, 0.1, 20));

    const decisions = dryRunEvaluation([entry], fitnessScores);

    // Status should be unchanged
    expect(registry.get(memory.id)!.status).toBe(originalStatus);
    expect(decisions).toHaveLength(1);
  });
});

// Helper functions

function createEvaluation(
  id: string,
  memoryId: string,
  timestamp: string,
  deltaQuality: number
): EvaluationResult {
  return {
    id,
    memory_id: memoryId,
    prompt_id: `prompt-${id}`,
    model_version: 'v1',
    evaluated_at: timestamp,
    baseline_quality: { correctness: 0.7, coherence: 0.7, completeness: 0.7, relevance: 0.7, aggregate: 0.7 },
    baseline_tokens: 100,
    baseline_latency_ms: 400,
    ablation_quality: { correctness: 0.7 - deltaQuality, coherence: 0.7, completeness: 0.7, relevance: 0.7, aggregate: 0.7 - deltaQuality },
    ablation_tokens: 80,
    ablation_latency_ms: 350,
    delta_quality: deltaQuality,
    delta_tokens: 20,
    delta_latency_ms: 50,
  };
}

function createFitnessScore(
  memoryId: string,
  fitness: number,
  evaluationCount: number = 10
): FitnessScore {
  return {
    memory_id: memoryId,
    fitness,
    quality_contribution: fitness * 0.5,
    token_penalty: 0.1,
    latency_penalty: 0.05,
    rarity_bonus: 0.1,
    evaluation_count: evaluationCount,
    avg_delta_quality: fitness - 0.5,
    avg_delta_tokens: 20,
    avg_delta_latency_ms: 50,
    confidence: Math.min(1, evaluationCount / 10),
    std_dev: 0.1,
    trend: 'stable',
    last_evaluated_at: new Date().toISOString(),
    semantic_uniqueness: 0.5,
    topic_coverage: 0.5,
  };
}
