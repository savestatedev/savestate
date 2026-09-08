import { describe, expect, it } from 'vitest';
import {
  formatSearchMissingJson,
  type SearchMissingJson,
} from '../search.js';

describe('savestate search --json when missing', () => {
  it('prints a missing snapshot summary as JSON without extra fields', () => {
    const parsed = JSON.parse(
      formatSearchMissingJson('cocktail recommendations', 'ss-missing'),
    ) as SearchMissingJson & {
      results?: unknown;
      passphrase?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      query: 'cocktail recommendations',
      snapshot: 'ss-missing',
      count: 0,
    });
    expect(parsed.results).toBeUndefined();
    expect(parsed.passphrase).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'count',
      'found',
      'query',
      'snapshot',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
