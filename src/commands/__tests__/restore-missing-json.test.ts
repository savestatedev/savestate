import { describe, expect, it } from 'vitest';
import {
  formatRestoreMissingJson,
  type RestoreMissingJson,
} from '../restore.js';

describe('savestate restore --json when missing', () => {
  it('prints a missing snapshot summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatRestoreMissingJson('ss-missing')) as RestoreMissingJson & {
      adapter?: unknown;
      memoryCount?: unknown;
      filename?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      snapshotId: 'ss-missing',
      timestamp: null,
      platform: null,
      hasIdentity: false,
    });
    expect(parsed.adapter).toBeUndefined();
    expect(parsed.memoryCount).toBeUndefined();
    expect(parsed.filename).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'found',
      'hasIdentity',
      'platform',
      'snapshotId',
      'timestamp',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
