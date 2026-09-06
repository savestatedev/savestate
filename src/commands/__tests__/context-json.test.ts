import { describe, expect, it } from 'vitest';
import type { RunBrief } from '../../context/index.js';
import {
  formatContextCompileJson,
  formatContextConfigJson,
  type ContextCompileJson,
  type ContextConfigJson,
} from '../context.js';

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
});
