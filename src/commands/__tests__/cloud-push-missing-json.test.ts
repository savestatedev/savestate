import { describe, expect, it } from 'vitest';
import {
  formatCloudPushMissingJson,
  type CloudPushMissingJson,
} from '../cloud.js';

describe('savestate cloud push --json when missing', () => {
  it('prints a missing snapshot push summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatCloudPushMissingJson('ss-missing')) as CloudPushMissingJson & {
      all?: unknown;
      snapshots?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      id: 'ss-missing',
      pushed: 0,
      failed: 0,
    });
    expect(parsed.all).toBeUndefined();
    expect(parsed.snapshots).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['failed', 'found', 'id', 'pushed']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
