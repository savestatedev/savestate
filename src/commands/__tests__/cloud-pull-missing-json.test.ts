import { describe, expect, it } from 'vitest';
import {
  formatCloudPullMissingJson,
  type CloudPullMissingJson,
} from '../cloud.js';

describe('savestate cloud pull --json when missing', () => {
  it('prints a missing snapshot pull summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatCloudPullMissingJson('ss-missing')) as CloudPullMissingJson & {
      all?: unknown;
      snapshots?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      id: 'ss-missing',
      pulled: 0,
      failed: 0,
      skipped: 0,
    });
    expect(parsed.all).toBeUndefined();
    expect(parsed.snapshots).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['failed', 'found', 'id', 'pulled', 'skipped']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
