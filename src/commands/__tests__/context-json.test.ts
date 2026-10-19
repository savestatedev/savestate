import { describe, expect, it } from 'vitest';
import type { ExplanationTrace, RunBrief } from '../../context/index.js';
import {
  formatContextCompileJson,
  formatContextCompilePaginationMessages,
  formatContextConfigJson,
  formatContextExplainJson,
  formatContextExplainPaginationMessages,
  formatContextValidateJson,
  getContextValidatePagination,
  type ContextCompileJson,
  type ContextConfigJson,
  type ContextExplainJson,
  type ContextValidateJson,
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
    expect(parsed.shown).toBe(8);
    expect(parsed.sections).toEqual([
      { id: 'must_know_facts', count: 2 },
      { id: 'active_state', count: 1 },
      { id: 'open_loops', count: 1 },
      { id: 'constraints', count: 1 },
      { id: 'recent_decisions', count: 1 },
      { id: 'unknowns', count: 1 },
      { id: 'conflicts', count: 1 },
      { id: 'citations', count: 1 },
    ]);
    expect(parsed.pagination).toEqual({
      offset: 0,
      limit: null,
      pageSize: 8,
      totalSections: 8,
      hasMore: false,
      nextOffset: null,
      previousOffset: null,
      suggestedOffset: null,
    });
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
    expect(parsed.shown).toBe(8);
  });

  it('pages compile sections and records pagination metadata', () => {
    const parsed = JSON.parse(
      formatContextCompileJson(
        brief({
          must_know_facts: [{ id: 'f1' } as never],
          open_loops: [{ id: 'l1' } as never],
          constraints: [{ id: 'c1' } as never],
        }),
        2,
        1,
      ),
    ) as ContextCompileJson;
    expect(parsed.sections).toEqual([
      { id: 'active_state', count: 0 },
      { id: 'open_loops', count: 1 },
    ]);
    expect(parsed.shown).toBe(2);
    expect(parsed.pagination).toEqual({
      offset: 1,
      limit: 2,
      pageSize: 2,
      totalSections: 8,
      hasMore: true,
      nextOffset: 3,
      previousOffset: 0,
      suggestedOffset: null,
    });
  });

  it('formats compile navigation hints for human output', () => {
    expect(formatContextCompilePaginationMessages(8, 2, 2)).toEqual([
      'More RunBrief sections available; rerun with --offset 4.',
      'Earlier RunBrief sections available; rerun with --offset 0.',
    ]);
    expect(formatContextCompilePaginationMessages(8, 2, 8)).toEqual([
      'Earlier RunBrief sections available; rerun with --offset 6.',
      'No RunBrief sections found at this offset; rerun with --offset 6.',
    ]);
  });

  it('keeps the requested page size when an offset is past the last section', () => {
    const parsed = JSON.parse(formatContextCompileJson(brief(), 2, 8)) as ContextCompileJson;
    expect(parsed.sections).toEqual([]);
    expect(parsed.shown).toBe(0);
    expect(parsed.pagination).toEqual({
      offset: 8,
      limit: 2,
      pageSize: 2,
      totalSections: 8,
      hasMore: false,
      nextOffset: null,
      previousOffset: 6,
      suggestedOffset: 6,
    });
  });

  it('prints scoring weights and budget allocation as JSON', () => {
    const parsed = JSON.parse(formatContextConfigJson()) as ContextConfigJson;
    expect(parsed.weights.relevance).toBe(0.3);
    expect(parsed.weights.criticality).toBe(0.25);
    expect(parsed.budget.must_know_facts_min).toBe(0.15);
    expect(parsed.budget.citations_max).toBe(0.05);
    expect(parsed.pagination).toEqual({
      offset: 0,
      limit: null,
      shownWeights: Object.keys(parsed.weights).length,
      shownBudget: Object.keys(parsed.budget).length,
      totalWeights: Object.keys(parsed.weights).length,
      totalBudget: Object.keys(parsed.budget).length,
      hasMoreWeights: false,
      hasMoreBudget: false,
      nextOffset: null,
      previousOffset: null,
      suggestedOffset: null,
    });
  });

  it('applies context config pagination to JSON output', () => {
    const parsed = JSON.parse(formatContextConfigJson(1, 1)) as ContextConfigJson;
    expect(Object.keys(parsed.weights)).toHaveLength(1);
    expect(Object.keys(parsed.budget)).toHaveLength(1);
    expect(parsed.pagination.offset).toBe(1);
    expect(parsed.pagination.limit).toBe(1);
    expect(parsed.pagination.shownWeights).toBe(1);
    expect(parsed.pagination.shownBudget).toBe(1);
    expect(parsed.pagination.totalWeights).toBeGreaterThan(1);
    expect(parsed.pagination.totalBudget).toBeGreaterThan(1);
    expect(parsed.pagination.hasMoreWeights).toBe(true);
    expect(parsed.pagination.hasMoreBudget).toBe(true);
    expect(parsed.pagination.nextOffset).toBe(2);
    expect(parsed.pagination.previousOffset).toBe(0);
  });

  it('suggests the last config page for a stale offset', () => {
    const parsed = JSON.parse(formatContextConfigJson(2, 1000)) as ContextConfigJson;
    expect(parsed.weights).toEqual({});
    expect(parsed.budget).toEqual({});
    expect(parsed.pagination.shownWeights).toBe(0);
    expect(parsed.pagination.shownBudget).toBe(0);
    expect(parsed.pagination.hasMoreWeights).toBe(false);
    expect(parsed.pagination.hasMoreBudget).toBe(false);
    expect(parsed.pagination.nextOffset).toBeNull();
    expect(parsed.pagination.previousOffset).toBe(998);
    expect(parsed.pagination.suggestedOffset).toBe(6);
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
    expect(parsed.emptyReason).toBeNull();
    expect(parsed.pagination).toEqual({
      offset: 0,
      limit: null,
      total: 3,
      pageSize: 3,
      hasMore: false,
      nextOffset: null,
      previousOffset: null,
      suggestedOffset: null,
    });
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
    expect(empty.emptyReason).toBe('collection');
    expect(empty.pagination).toEqual({
      offset: 0,
      limit: null,
      total: 0,
      pageSize: 0,
      hasMore: false,
      nextOffset: null,
      previousOffset: null,
      suggestedOffset: null,
    });
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

  it('reports continuation and empty-page state for paged explanations', () => {
    const paged = JSON.parse(
      formatContextExplainJson(
        explanation({
          total_candidates: 5,
          candidates: Array.from({ length: 5 }, (_, index) =>
            candidate({ candidate_id: `c${index + 1}` }),
          ),
        }),
        2,
        2,
      ),
    ) as ContextExplainJson;
    expect(paged.emptyReason).toBeNull();
    expect(paged.pagination).toEqual({
      offset: 2,
      limit: 2,
      total: 5,
      pageSize: 2,
      hasMore: true,
      nextOffset: 4,
      previousOffset: 0,
      suggestedOffset: null,
    });

    const emptyPage = JSON.parse(
      formatContextExplainJson(
        explanation({
          total_candidates: 5,
          candidates: Array.from({ length: 5 }, (_, index) =>
            candidate({ candidate_id: `c${index + 1}` }),
          ),
        }),
        2,
        6,
      ),
    ) as ContextExplainJson;
    expect(emptyPage.emptyReason).toBe('page');
    expect(emptyPage.pagination).toEqual({
      offset: 6,
      limit: 2,
      total: 5,
      pageSize: 2,
      hasMore: false,
      nextOffset: null,
      previousOffset: 4,
      suggestedOffset: 4,
    });
  });

  it('formats navigation hints for human-readable explanations', () => {
    const trace = explanation({
      total_candidates: 5,
      candidates: Array.from({ length: 5 }, (_, index) => candidate({ candidate_id: `c${index + 1}` })),
    });
    expect(formatContextExplainPaginationMessages(trace, 2, 2)).toEqual([
      'More explanation candidates available; rerun with --offset 4.',
      'Earlier explanation candidates available; rerun with --offset 0.',
    ]);
    expect(formatContextExplainPaginationMessages(trace, 2, 6)).toEqual([
      'Earlier explanation candidates available; rerun with --offset 4.',
      'No explanation candidates found at this offset; rerun with --offset 4.',
    ]);
  });

  it('prints validate coverage as JSON', () => {
    const parsed = JSON.parse(
      formatContextValidateJson('brief.json', {
        valid: true,
        errors: [],
        warnings: ['No must_know_facts included'],
        coverage: {
          constraints_covered: 2,
          constraints_total: 2,
          required_facts_present: false,
        },
      }),
    ) as ContextValidateJson;
    expect(parsed).toEqual({
      file: 'brief.json',
      valid: true,
      errors: [],
      warnings: ['No must_know_facts included'],
      pagination: {
        offset: 0,
        limit: null,
        totalErrors: 0,
        totalWarnings: 1,
        hasMore: false,
        nextOffset: null,
        previousOffset: null,
        suggestedOffset: null,
      },
      coverage: {
        constraintsCovered: 2,
        constraintsTotal: 2,
        requiredFactsPresent: false,
      },
    });
  });

  it('records an invalid brief with errors', () => {
    const parsed = JSON.parse(
      formatContextValidateJson('broken.json', {
        valid: false,
        errors: ['Missing run_id', 'Budget exceeded'],
        warnings: [],
        coverage: {
          constraints_covered: 0,
          constraints_total: 0,
          required_facts_present: false,
        },
      }),
    ) as ContextValidateJson;
    expect(parsed.file).toBe('broken.json');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors).toEqual(['Missing run_id', 'Budget exceeded']);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.pagination).toEqual({
      offset: 0,
      limit: null,
      totalErrors: 2,
      totalWarnings: 0,
      hasMore: false,
      nextOffset: null,
      previousOffset: null,
      suggestedOffset: null,
    });
    expect(parsed.coverage.constraintsCovered).toBe(0);
    expect(parsed.coverage.requiredFactsPresent).toBe(false);
  });

  it('reports totals and the requested page for validation JSON', () => {
    const parsed = JSON.parse(
      formatContextValidateJson(
        'brief.json',
        {
          valid: false,
          errors: ['e1', 'e2', 'e3'],
          warnings: ['w1', 'w2'],
          coverage: {
            constraints_covered: 0,
            constraints_total: 1,
            required_facts_present: false,
          },
        },
        1,
        1,
      ),
    ) as ContextValidateJson;
    expect(parsed.errors).toEqual(['e2']);
    expect(parsed.warnings).toEqual(['w2']);
    expect(parsed.pagination).toEqual({
      offset: 1,
      limit: 1,
      totalErrors: 3,
      totalWarnings: 2,
      hasMore: true,
      nextOffset: 2,
      previousOffset: 0,
      suggestedOffset: null,
    });
  });

  it('reports the next validation offset for human-readable paging', () => {
    expect(
      getContextValidatePagination(
        {
          valid: false,
          errors: ['e1', 'e2', 'e3'],
          warnings: ['w1', 'w2'],
          coverage: {
            constraints_covered: 0,
            constraints_total: 1,
            required_facts_present: false,
          },
        },
        1,
        1,
      ),
    ).toEqual({
      offset: 1,
      limit: 1,
      totalErrors: 3,
      totalWarnings: 2,
      hasMore: true,
      nextOffset: 2,
      previousOffset: 0,
      suggestedOffset: null,
    });
  });

  it('suggests the last validation page for a stale offset', () => {
    const parsed = JSON.parse(
      formatContextValidateJson(
        'brief.json',
        {
          valid: false,
          errors: ['e1', 'e2', 'e3', 'e4', 'e5'],
          warnings: [],
          coverage: {
            constraints_covered: 0,
            constraints_total: 0,
            required_facts_present: false,
          },
        },
        2,
        8,
      ),
    ) as ContextValidateJson;
    expect(parsed.errors).toEqual([]);
    expect(parsed.pagination.suggestedOffset).toBe(4);
  });
});
