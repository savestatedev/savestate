import { describe, expect, it } from 'vitest';
import {
  formatCloudListMissingJson,
  type CloudListMissingJson,
} from '../cloud.js';

describe('savestate cloud list --json when missing', () => {
  it('prints a missing cloud list summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatCloudListMissingJson()) as CloudListMissingJson & {
      snapshots?: unknown;
      tier?: unknown;
      cloudStorageUsed?: unknown;
      cloudStorageLimit?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      total: 0,
      shown: 0,
    });
    expect(parsed.snapshots).toBeUndefined();
    expect(parsed.tier).toBeUndefined();
    expect(parsed.cloudStorageUsed).toBeUndefined();
    expect(parsed.cloudStorageLimit).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'shown', 'total']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
