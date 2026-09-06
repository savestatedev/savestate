import { describe, expect, it } from 'vitest';
import type { ExplanationTrace, RunBrief } from '../../context/index.js';
import {
  formatContextCompileJson,
  formatContextConfigJson,
  formatContextExplainJson,
  type ContextCompileJson,
  type ContextConfigJson,
  type ContextExplainJson,
} from '../context.js';

function candidate(partial: Partial<ExplanationTrace['candidates'][number]> = {}): ExplanationTrace['candidates'][number] {
  return {
    candidate_id: partial.candidate_id ?? 'c0',
    included: partial.included ?? false,
    score: partial.score ?? 0,
    score_breakdown: partial.score_breakdown ?? {
      relevance: 0,
      recency: 0,
      importance: 0,
      criticality: 0,
      trust: 0,
      redundancy_penalty: 0,
    },
    reason: partial.reason ?? '',
  };
}

function explanation(partial: Partial<ExplanationTrace> = {}): ExplanationTrace {
  return {
    run_id: partial.run_id ?? 'run_empty',
    compiled_at: partial.compiled_at ?? '2026-09-05T12:00:00.000Z',
    total_candidates: partial.total_candidates ?? 0,
    included_count: partial.included_count ?? 0,
    excluded_count: partial.excluded_count ?? 0,
    candidates: partial.candidates ?? [],
    budget_allocation: partial.budget_allocation ?? {
      must_know_facts: 0,
      constraints: 0,
      open_loops: 0,
      active_state: 0,
      recent_decisions: 0,
      conflicts: 0,
      unknowns: 0,
      citations: 0,
    },
  };
}

function brief(partial: Partial<RunBrief> = {}): RunBrief {
  return {
    must_know_facts: partial.must_know_facts ?? [],
    active_state: partial.active_state ?? {},
    open_loops: partial.open_loops ?? [],
    constraints: partial.constraints ?? [],
    recent_decisions: partial.recent_decisions ?? [],
    unknowns: partial.unknowns ?? [],
    conflicts: partial.conflicts ?? [],
    citations: partial.citations ?? [],
    compiled_at: partial.compiled_at ?? '2026-09-05T12:00:00.000Z',
    token_count: partial.token_count ?? 0,
    budget_remaining: partial.budget_remaining ?? 4000,
    run_id: partial.run_id ?? 'run_empty',
  };
}

describe('savestate context --json', () => {
  it('prints compile section counts as JSON', () => {
    const parsed = JSON.parse(
      formatContextCompileJson(
        brief({
          run_id: 'run_abc123',
          compiled_at: '2026-09-05T12:00:00.000Z',
          token_count: 120,
          budget_remaining: 3880,
          must_know_facts: [
            { id: 'f1', content: 'pref', source: 'memory', importance: 1, created_at: '2026-09-01T00:00:00Z' },
            { id: 'f2', content: 'name', source: 'memory', importance: 0.8, created_at: '2026-09-01T00:00:00Z' },
          ],
          active_state: {
            inbox: { id: 'inbox', type: 'box', name: 'Inbox', state: {}, updated_at: '2026-09-05T00:00:00Z' },
          },
          open_loops: [
            { id: 'l1', description: 'reply', priority: 'high', created_at: '2026-09-05T00:00:00Z' },
          ],
          constraints: [
            { id: 'c1', type: 'user', description: 'no spam', source: 'policy', active: true },
          ],
          recent_decisions: [
            { id: 'd1', description: 'archive', rationale: 'stale', made_at: '2026-09-04T00:00:00Z', confidence: 0.9 },
          ],
          conflicts: [
            { id: 'x1', description: 'dup', sources: ['a', 'b'], conflicting_values: [1, 2], detected_at: '2026-09-05T00:00:00Z' },
          ],
          unknowns: [
            { id: 'u1', description: 'timezone', importance: 'low' },
          ],
          citations: [
            { id: 'cit1', memory_id: 'm1', source: 'core', retrieved_at: '2026-09-05T00:00:00Z', relevance_score: 0.7 },
          ],
        }),
      ),
    ) as ContextCompileJson;
    expect(parsed.runId).toBe('run_abc123');
    expect(parsed.compiledAt).toBe('2026-09-05T12:00:00.000Z');
    expect(parsed.tokenCount).toBe(120);
    expect(parsed.budgetRemaining).toBe(3880);
    expect(parsed.mustKnowFacts).toBe(2);
    expect(parsed.activeState).toBe(1);
    expect(parsed.openLoops).toBe(1);
    expect(parsed.constraints).toBe(1);
    expect(parsed.recentDecisions).toBe(1);
    expect(parsed.conflicts).toBe(1);
    expect(parsed.unknowns).toBe(1);
    expect(parsed.citations).toBe(1);
  });

  it('records empty sections as 0', () => {
    const parsed = JSON.parse(formatContextCompileJson(brief())) as ContextCompileJson;
    expect(parsed.runId).toBe('run_empty');
    expect(parsed.mustKnowFacts).toBe(0);
    expect(parsed.activeState).toBe(0);
    expect(parsed.openLoops).toBe(0);
    expect(parsed.constraints).toBe(0);
    expect(parsed.recentDecisions).toBe(0);
    expect(parsed.conflicts).toBe(0);
    expect(parsed.unknowns).toBe(0);
    expect(parsed.citations).toBe(0);
    expect(parsed.tokenCount).toBe(0);
    expect(parsed.budgetRemaining).toBe(4000);
  });

  it('prints scoring weights and budget allocation as JSON', () => {
    const parsed = JSON.parse(formatContextConfigJson()) as ContextConfigJson;
    expect(parsed.weights.relevance).toBe(0.3);
    expect(parsed.weights.criticality).toBe(0.25);
    expect(parsed.budget.must_know_facts_min).toBe(0.15);
    expect(parsed.budget.citations_max).toBe(0.05);
  });

  it('prints explain inclusion counts as JSON', () => {
    const parsed = JSON.parse(
      formatContextExplainJson(
        explanation({
          run_id: 'run_abc123',
          compiled_at: '2026-09-05T12:00:00.000Z',
          total_candidates: 3,
          included_count: 2,
          excluded_count: 1,
          budget_allocation: {
            must_know_facts: 600,
            constraints: 400,
            open_loops: 300,
            active_state: 500,
            recent_decisions: 200,
            conflicts: 100,
            unknowns: 50,
            citations: 80,
          },
          candidates: [
            candidate({ candidate_id: 'c1', included: true, score: 0.91, reason: 'must-know' }),
            candidate({ candidate_id: 'c2', included: true, score: 0.72, reason: 'open loop' }),
            candidate({ candidate_id: 'c3', included: false, score: 0.11, reason: 'over budget' }),
          ],
        }),
      ),
    ) as ContextExplainJson;
    expect(parsed.runId).toBe('run_abc123');
    expect(parsed.compiledAt).toBe('2026-09-05T12:00:00.000Z');
    expect(parsed.totalCandidates).toBe(3);
    expect(parsed.included).toBe(2);
    expect(parsed.excluded).toBe(1);
    expect(parsed.budget.mustKnowFacts).toBe(600);
    expect(parsed.budget.openLoops).toBe(300);
    expect(parsed.shown).toBe(3);
    expect(parsed.candidates).toEqual([
      { id: 'c1', included: true, score: 0.91, reason: 'must-know' },
      { id: 'c2', included: true, score: 0.72, reason: 'open loop' },
      { id: 'c3', included: false, score: 0.11, reason: 'over budget' },
    ]);
    expect(JSON.stringify(parsed)).not.toContain('score_breakdown');
  });

  it('caps explain candidates at 10 and records empty traces', () => {
    const empty = JSON.parse(formatContextExplainJson(explanation())) as ContextExplainJson;
    expect(empty.runId).toBe('run_empty');
    expect(empty.totalCandidates).toBe(0);
    expect(empty.included).toBe(0);
    expect(empty.excluded).toBe(0);
    expect(empty.shown).toBe(0);
    expect(empty.candidates).toEqual([]);
    expect(empty.budget.citations).toBe(0);

    const many = JSON.parse(
      formatContextExplainJson(
        explanation({
          total_candidates: 12,
          included_count: 12,
          candidates: Array.from({ length: 12 }, (_, index) =>
            candidate({ candidate_id: `c${index + 1}`, included: true, score: 1 - index / 20 }),
          ),
        }),
      ),
    ) as ContextExplainJson;
    expect(many.totalCandidates).toBe(12);
    expect(many.shown).toBe(10);
    expect(many.candidates).toHaveLength(10);
    expect(many.candidates[0].id).toBe('c1');
    expect(many.candidates[9].id).toBe('c10');
  });
});
