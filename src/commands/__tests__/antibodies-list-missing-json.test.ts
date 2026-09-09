import { describe, expect, it } from 'vitest';
import {
  formatAntibodiesListMissingJson,
  type AntibodiesListMissingJson,
} from '../antibodies.js';

describe('savestate antibodies list --json when missing', () => {
  it('prints a missing antibody list as JSON without extra fields', () => {
    const parsed = JSON.parse(formatAntibodiesListMissingJson()) as AntibodiesListMissingJson & {
      rules?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      total: 0,
      shown: 0,
    });
    expect(parsed.rules).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'shown', 'total']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
