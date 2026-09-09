import { describe, expect, it } from 'vitest';
import {
  formatSloStatusMissingJson,
  type SloStatusMissingJson,
} from '../slo.js';

describe('savestate slo status --json when missing', () => {
  it('prints a missing SLO status summary as JSON without extra fields', () => {
    const parsed = JSON.parse(
      formatSloStatusMissingJson('org:missing'),
    ) as SloStatusMissingJson & {
      evaluatedAt?: unknown;
      freshness?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      enabled: false,
      namespace: 'org:missing',
      compliant: false,
      violations: 0,
    });
    expect(parsed.evaluatedAt).toBeUndefined();
    expect(parsed.freshness).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'compliant',
      'enabled',
      'found',
      'namespace',
      'violations',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
