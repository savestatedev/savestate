import { describe, expect, it } from 'vitest';
import {
  formatSloReportMissingJson,
  type SloReportMissingJson,
} from '../slo.js';

describe('savestate slo report --json when missing', () => {
  it('prints a missing SLO report summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatSloReportMissingJson()) as SloReportMissingJson & {
      periodStart?: unknown;
      freshQueries?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      enabled: false,
      reportId: null,
      totalQueries: 0,
      namespaces: 0,
    });
    expect(parsed.periodStart).toBeUndefined();
    expect(parsed.freshQueries).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'enabled',
      'found',
      'namespaces',
      'reportId',
      'totalQueries',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
