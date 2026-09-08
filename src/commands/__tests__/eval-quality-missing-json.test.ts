import { describe, expect, it } from 'vitest';
import {
  formatEvalQualityMissingJson,
  type EvalQualityMissingJson,
} from '../eval.js';

describe('savestate eval quality --json when missing', () => {
  it('prints a missing suite summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatEvalQualityMissingJson('recall')) as EvalQualityMissingJson & {
      suites?: unknown;
      secret?: unknown;
      file?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      suite: 'recall',
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
      'suite',
      'suiteCount',
      'total',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
