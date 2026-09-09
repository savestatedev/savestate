import { describe, expect, it } from 'vitest';
import {
  formatListMissingJson,
  type ListMissingJson,
} from '../list.js';

describe('savestate list --json when missing', () => {
  it('prints a missing list summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatListMissingJson()) as ListMissingJson & {
      snapshots?: unknown;
      adapter?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      total: 0,
      storage: null,
    });
    expect(parsed.snapshots).toBeUndefined();
    expect(parsed.adapter).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'storage', 'total']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
