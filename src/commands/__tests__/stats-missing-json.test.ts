import { describe, expect, it } from 'vitest';
import {
  formatStatsMissingJson,
  type StatsMissingJson,
} from '../stats.js';

describe('savestate stats --json when missing', () => {
  it('prints a missing stats summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatStatsMissingJson()) as StatsMissingJson & {
      byAdapter?: unknown;
      topTags?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      total: 0,
      totalBytes: 0,
      first: null,
      latest: null,
      storage: null,
    });
    expect(parsed.byAdapter).toBeUndefined();
    expect(parsed.topTags).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'first',
      'found',
      'latest',
      'storage',
      'total',
      'totalBytes',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
