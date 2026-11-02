import { describe, expect, it } from 'vitest';
import {
  type EvalPagination,
  formatEvalReportMissingJson,
  type EvalReportMissingJson,
} from '../eval.js';

describe('savestate eval report --json when missing', () => {
  it('prints a missing report summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatEvalReportMissingJson()) as EvalReportMissingJson & {
      suites?: unknown;
      secret?: unknown;
      file?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      suiteCount: 0,
      passed: 0,
      total: 0,
      passRate: 0,
    });
    expect(parsed.suites).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(parsed.file).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'found',
      'passRate',
      'passed',
      'suiteCount',
      'total',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('preserves pagination metadata when a requested report page is missing', () => {
    const pagination: EvalPagination = {
      offset: 4,
      limit: 2,
      total: 0,
      shown: 0,
      emptyReason: 'collection',
      suggestedOffset: null,
      hasMore: false,
      nextOffset: null,
      hasPrevious: true,
      previousOffset: 2,
    };
    const parsed = JSON.parse(formatEvalReportMissingJson(pagination)) as EvalReportMissingJson;

    expect(parsed.found).toBe(false);
    expect(parsed.pagination).toEqual(pagination);
  });
});
