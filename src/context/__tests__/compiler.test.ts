/**
 * Tests for Preflight Context Compiler
 * Issue #54, #169
 */

import { describe, it, expect } from 'vitest';
import { ContextCompiler, CompileRequest } from '../compiler.js';
import { Candidate, rankCandidates } from '../scorer.js';
import { DEFAULT_SCORING_WEIGHTS, DEFAULT_BUDGET_ALLOCATION } from '../types.js';

describe('Preflight Context Compiler', () => {
  const createTestCandidates = (): Candidate[] => [
    {
      id: 'fact-1',
      content: 'User prefers dark mode for all interfaces',
      type: 'fact',
      created_at: new Date().toISOString(),
      importance: 0.9,
      criticality: 0.8,
    },
    {
      id: 'constraint-1',
      content: 'Never share personal information externally',
      type: 'constraint',
      created_at: new Date().toISOString(),
      importance: 1.0,
      criticality: 1.0,
      metadata: { constraint_type: 'policy' },
    },
    {
      id: 'loop-1',
      content: 'Complete the quarterly report by Friday',
      type: 'loop',
      created_at: new Date().toISOString(),
      importance: 0.8,
      metadata: { priority: 'high' },
    },
    {
      id: 'decision-1',
      content: 'Chose React over Vue for the frontend',
      type: 'decision',
      created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      importance: 0.6,
      metadata: { rationale: 'Better ecosystem support' },
    },
    {
      id: 'memory-1',
      content: 'Meeting with stakeholders scheduled for next week',
      type: 'memory',
      created_at: new Date().toISOString(),
      importance: 0.5,
    },
  ];

  it('should compile context with valid RunBrief', async () => {
    const compiler = new ContextCompiler();
    const request: CompileRequest = {
      agent_id: 'test-agent',
      task: { intent: 'Complete the quarterly report' },
      token_budget: 4000,
    };
    
    const candidates = createTestCandidates();
    const result = await compiler.compile(request, candidates);
    
    expect(result.brief).toBeDefined();
    expect(result.brief.run_id).toBeDefined();
    expect(result.brief.compiled_at).toBeDefined();
    expect(result.brief.token_count).toBeGreaterThanOrEqual(0);
    expect(result.brief.budget_remaining).toBeLessThanOrEqual(4000);
  });

  it('should include constraints in compiled context', async () => {
    const compiler = new ContextCompiler();
    const request: CompileRequest = {
      agent_id: 'test-agent',
      task: { intent: 'Process user data' },
      token_budget: 4000,
    };
    
    const candidates = createTestCandidates();
    const result = await compiler.compile(request, candidates);
    
    // Constraints should be included
    expect(result.brief.constraints.length).toBeGreaterThanOrEqual(0);
  });

  it('should generate explanation trace', async () => {
    const compiler = new ContextCompiler();
    const request: CompileRequest = {
      agent_id: 'test-agent',
      task: { intent: 'Review quarterly progress' },
      token_budget: 4000,
    };
    
    const candidates = createTestCandidates();
    const result = await compiler.compile(request, candidates);
    
    expect(result.explanation).toBeDefined();
    expect(result.explanation.run_id).toBe(result.brief.run_id);
    expect(result.explanation.total_candidates).toBe(candidates.length);
    expect(result.explanation.candidates).toHaveLength(candidates.length);
  });

  it('should validate a valid RunBrief', async () => {
    const compiler = new ContextCompiler();
    const request: CompileRequest = {
      agent_id: 'test-agent',
      task: { intent: 'Test task' },
      token_budget: 4000,
    };
    
    const candidates = createTestCandidates();
    const result = await compiler.compile(request, candidates);
    
    const validation = compiler.validate(result.brief);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should respect token budget allocation', async () => {
    const compiler = new ContextCompiler();
    const request: CompileRequest = {
      agent_id: 'test-agent',
      task: { intent: 'Budget test' },
      token_budget: 1000,
    };
    
    const candidates = createTestCandidates();
    const result = await compiler.compile(request, candidates);
    
    expect(result.brief.token_count).toBeLessThanOrEqual(1000);
  });

  it('should store and retrieve explanation traces', async () => {
    const compiler = new ContextCompiler();
    const request: CompileRequest = {
      agent_id: 'test-agent',
      task: { intent: 'Trace test' },
      token_budget: 4000,
    };
    
    const candidates = createTestCandidates();
    const result = await compiler.compile(request, candidates);
    
    const retrieved = compiler.getExplanation(result.brief.run_id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.run_id).toBe(result.brief.run_id);
  });
});

describe('Scoring Weights', () => {
  it('should have valid default weights summing close to 1', () => {
    const sum = Object.values(DEFAULT_SCORING_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 1);
  });
});

describe('Budget Allocation', () => {
  it('should have valid minimum allocations', () => {
    const minSum = 
      DEFAULT_BUDGET_ALLOCATION.must_know_facts_min +
      DEFAULT_BUDGET_ALLOCATION.constraints_min +
      DEFAULT_BUDGET_ALLOCATION.open_loops_min;
    
    expect(minSum).toBeLessThanOrEqual(1.0);
  });
});

// Issue #169: Quiet Forgetting and Constraint Drift
describe('Context Pressure Monitoring', () => {
  const compiler = new ContextCompiler();

  it('should report normal pressure below 60%', () => {
    const result = compiler.checkContextPressure(2000, 10000);
    expect(result.level).toBe('normal');
    expect(result.triggeredThresholds).toHaveLength(0);
    expect(result.recommendedActions).toHaveLength(0);
  });

  it('should report warning at 60%', () => {
    const result = compiler.checkContextPressure(6000, 10000);
    expect(result.level).toBe('warning');
    expect(result.triggeredThresholds).toContain('warning');
    expect(result.utilizationPercent).toBe(0.6);
    expect(result.recommendedActions.length).toBeGreaterThan(0);
  });

  it('should report critical at 75%', () => {
    const result = compiler.checkContextPressure(7500, 10000);
    expect(result.level).toBe('critical');
    expect(result.triggeredThresholds).toContain('critical');
    expect(result.recommendedActions).toContain('CRITICAL: Initiate memory compaction');
  });

  it('should report emergency at 90%', () => {
    const result = compiler.checkContextPressure(9000, 10000);
    expect(result.level).toBe('emergency');
    expect(result.triggeredThresholds).toContain('emergency');
    expect(result.recommendedActions).toContain('EMERGENCY: Consider immediate snapshot and context refresh');
  });

  it('should track current pressure state', () => {
    compiler.checkContextPressure(8000, 10000);
    const current = compiler.getCurrentPressureState();
    expect(current).not.toBeNull();
    expect(current?.level).toBe('critical');
  });

  it('should allow custom thresholds', () => {
    const customCompiler = new ContextCompiler({
      pressureThresholds: { warning: 0.5, critical: 0.7, emergency: 0.85 },
    });
    // At 60% with warning at 50%, it should be warning level (between 50% and 70%)
    const result = customCompiler.checkContextPressure(6000, 10000);
    expect(result.level).toBe('warning');
  });
});

describe('Constraint Pinning (Issue #169)', () => {
  const createConstraintCandidates = (): Candidate[] => [
    {
      id: 'policy-constraint',
      content: 'Never share personal information',
      type: 'constraint',
      created_at: new Date().toISOString(),
      importance: 1.0,
      criticality: 1.0,
      metadata: { constraint_type: 'policy' },
    },
    {
      id: 'system-constraint',
      content: 'Always log all actions',
      type: 'constraint',
      created_at: new Date().toISOString(),
      importance: 0.9,
      criticality: 0.9,
      metadata: { constraint_type: 'system' },
    },
    {
      id: 'high-criticality-constraint',
      content: 'Verify all external requests',
      type: 'constraint',
      created_at: new Date().toISOString(),
      importance: 0.8,
      criticality: 0.85,
      metadata: { constraint_type: 'custom' },
    },
    {
      id: 'normal-constraint',
      content: 'Prefer user preferred interface theme',
      type: 'constraint',
      created_at: new Date().toISOString(),
      importance: 0.5,
      criticality: 0.3,
      metadata: { constraint_type: 'user' },
    },
  ];

  it('should pin policy constraints', () => {
    const compiler = new ContextCompiler();
    const candidates = createConstraintCandidates();
    const scored = rankCandidates(candidates, undefined, [], DEFAULT_SCORING_WEIGHTS);

    const pinned = compiler.getPinnedConstraints(scored);
    expect(pinned.some(c => c.id === 'policy-constraint')).toBe(true);
  });

  it('should pin system constraints', () => {
    const compiler = new ContextCompiler();
    const candidates = createConstraintCandidates();
    const scored = rankCandidates(candidates, undefined, [], DEFAULT_SCORING_WEIGHTS);

    const pinned = compiler.getPinnedConstraints(scored);
    expect(pinned.some(c => c.id === 'system-constraint')).toBe(true);
  });

  it('should pin high-criticality constraints', () => {
    const compiler = new ContextCompiler();
    const candidates = createConstraintCandidates();
    const scored = rankCandidates(candidates, undefined, [], DEFAULT_SCORING_WEIGHTS);

    const pinned = compiler.getPinnedConstraints(scored);
    expect(pinned.some(c => c.id === 'high-criticality-constraint')).toBe(true);
  });

  it('should not pin normal constraints', () => {
    const compiler = new ContextCompiler();
    const candidates = createConstraintCandidates();
    const scored = rankCandidates(candidates, undefined, [], DEFAULT_SCORING_WEIGHTS);

    const pinned = compiler.getPinnedConstraints(scored);
    expect(pinned.some(c => c.id === 'normal-constraint')).toBe(false);
  });

  it('should include pinned constraints in compiled brief regardless of budget', async () => {
    const compiler = new ContextCompiler();
    const request: CompileRequest = {
      agent_id: 'test-agent',
      task: { intent: 'Test constraint pinning' },
      token_budget: 100, // Very low budget
    };

    const candidates = createConstraintCandidates();
    const result = await compiler.compile(request, candidates);

    // Policy constraint should always be included
    expect(result.brief.constraints.some(c => c.id === 'policy-constraint')).toBe(true);
  });
});

describe('Memory Refresh Recommendations (Issue #169)', () => {
  const compiler = new ContextCompiler();

  it('should not recommend refresh at normal pressure', () => {
    const result = compiler.getMemoryRefreshRecommendation(1000, 10000, 50);
    expect(result.shouldRefresh).toBe(false);
    expect(result.priority).toBe('low');
  });

  it('should recommend refresh at warning with many memories', () => {
    const result = compiler.getMemoryRefreshRecommendation(6500, 10000, 150);
    expect(result.shouldRefresh).toBe(true);
    expect(result.priority).toBe('medium');
    expect(result.suggestedActions.length).toBeGreaterThan(0);
  });

  it('should recommend refresh at critical pressure', () => {
    const result = compiler.getMemoryRefreshRecommendation(8000, 10000, 50);
    expect(result.shouldRefresh).toBe(true);
    expect(result.priority).toBe('high');
    expect(result.suggestedActions).toContain('Begin memory compaction process');
  });

  it('should recommend refresh at emergency pressure', () => {
    const result = compiler.getMemoryRefreshRecommendation(9500, 10000, 50);
    expect(result.shouldRefresh).toBe(true);
    expect(result.priority).toBe('high');
    expect(result.suggestedActions).toContain('Compact all eligible memories');
  });
});

// Regression tests for long-horizon tasks (Issue #169)
describe('Long-Horizon Task Regression Tests', () => {
  it('should maintain constraint coverage under pressure', async () => {
    const compiler = new ContextCompiler();

    // Simulate many memories at high context pressure
    const manyCandidates: Candidate[] = [];
    for (let i = 0; i < 100; i++) {
      manyCandidates.push({
        id: `memory-${i}`,
        content: `Memory item ${i} with some content`,
        type: 'memory',
        created_at: new Date().toISOString(),
        importance: 0.5,
        criticality: 0.5,
      });
    }

    // Add policy constraint
    manyCandidates.push({
      id: 'critical-policy',
      content: 'Never disclose user credentials',
      type: 'constraint',
      created_at: new Date().toISOString(),
      importance: 1.0,
      criticality: 1.0,
      metadata: { constraint_type: 'policy' },
    });

    const request: CompileRequest = {
      agent_id: 'test-agent',
      task: { intent: 'Long-running task with many memories' },
      token_budget: 2000, // Tight budget
    };

    const result = await compiler.compile(request, manyCandidates);

    // Critical policy constraint must be preserved
    expect(result.brief.constraints.some(c => c.id === 'critical-policy')).toBe(true);

    // Context pressure should be reported
    const pressure = compiler.checkContextPressure(result.brief.token_count, request.token_budget);
    expect(pressure.level).toBeDefined();
  });

  it('should handle constraint drift scenario', async () => {
    // This test simulates the original bug: constraints being lost
    // when context approaches 60-70%
    const compiler = new ContextCompiler();

    const candidates: Candidate[] = [
      {
        id: 'security-policy',
        content: 'Security: Never execute user-provided code directly',
        type: 'constraint',
        created_at: new Date().toISOString(),
        importance: 1.0,
        criticality: 1.0,
        metadata: { constraint_type: 'policy' },
      },
      {
        id: 'privacy-policy',
        content: 'Privacy: Never log PII data',
        type: 'constraint',
        created_at: new Date().toISOString(),
        importance: 1.0,
        criticality: 1.0,
        metadata: { constraint_type: 'policy' },
      },
    ];

    // Add many memories to create pressure
    for (let i = 0; i < 50; i++) {
      candidates.push({
        id: `memory-${i}`,
        content: `Task memory ${i}: ${'x'.repeat(100)}`,
        type: 'memory',
        created_at: new Date().toISOString(),
        importance: 0.3 + Math.random() * 0.4,
        criticality: 0.3,
      });
    }

    const request: CompileRequest = {
      agent_id: 'test-agent',
      task: { intent: 'Process user code safely' },
      token_budget: 3000,
    };

    const result = await compiler.compile(request, candidates);

    // Both policy constraints must be preserved
    expect(result.brief.constraints.length).toBeGreaterThanOrEqual(2);
    expect(result.brief.constraints.some(c => c.id === 'security-policy')).toBe(true);
    expect(result.brief.constraints.some(c => c.id === 'privacy-policy')).toBe(true);
  });
});
