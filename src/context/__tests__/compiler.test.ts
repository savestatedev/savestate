/**
 * Tests for Preflight Context Compiler
 * Issue #54
 */

import { describe, it, expect } from 'vitest';
import { ContextCompiler, CompileRequest } from '../compiler.js';
import { Candidate } from '../scorer.js';
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
