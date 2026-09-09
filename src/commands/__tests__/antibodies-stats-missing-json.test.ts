import { describe, expect, it } from 'vitest';
import {
  formatAntibodiesStatsMissingJson,
  type AntibodiesStatsMissingJson,
} from '../antibodies.js';

describe('savestate antibodies stats --json when missing', () => {
  it('prints a missing antibody stats summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatAntibodiesStatsMissingJson()) as AntibodiesStatsMissingJson & {
      rules?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      totalRules: 0,
      activeRules: 0,
      retiredRules: 0,
      totalHits: 0,
      totalOverrides: 0,
    });
    expect(parsed.rules).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'activeRules',
      'found',
      'retiredRules',
      'totalHits',
      'totalOverrides',
      'totalRules',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
