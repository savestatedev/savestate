import { describe, expect, it } from 'vitest';
import {
  formatContextExplainMissingJson,
  type ContextExplainMissingJson,
} from '../context.js';

describe('savestate context explain --json when missing', () => {
  it('prints a missing explanation summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatContextExplainMissingJson('run_abc123')) as ContextExplainMissingJson & {
      candidates?: unknown;
      budget?: unknown;
      shown?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      runId: 'run_abc123',
      compiledAt: null,
      totalCandidates: 0,
      included: 0,
      excluded: 0,
    });
    expect(parsed.candidates).toBeUndefined();
    expect(parsed.budget).toBeUndefined();
    expect(parsed.shown).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'compiledAt',
      'excluded',
      'found',
      'included',
      'runId',
      'totalCandidates',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
