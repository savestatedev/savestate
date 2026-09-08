import { describe, expect, it } from 'vitest';
import {
  formatCloudDeleteMissingJson,
  type CloudDeleteMissingJson,
} from '../cloud.js';

describe('savestate cloud delete --json when missing', () => {
  it('prints a missing snapshot delete summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatCloudDeleteMissingJson('ss-missing')) as CloudDeleteMissingJson & {
      all?: unknown;
      snapshots?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      id: 'ss-missing',
      deleted: 0,
      failed: 0,
    });
    expect(parsed.all).toBeUndefined();
    expect(parsed.snapshots).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['deleted', 'failed', 'found', 'id']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
