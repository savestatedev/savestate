import { describe, expect, it } from 'vitest';
import {
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
});
