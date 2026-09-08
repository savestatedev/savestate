import { describe, expect, it } from 'vitest';
import {
  formatSnapshotMissingJson,
  type SnapshotMissingJson,
} from '../snapshot.js';

describe('savestate snapshot --json when missing', () => {
  it('prints a missing adapter summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatSnapshotMissingJson('missing')) as SnapshotMissingJson & {
      delta?: unknown;
      storage?: unknown;
      fileCount?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      adapter: 'missing',
      snapshotId: null,
      timestamp: null,
      platform: null,
    });
    expect(parsed.delta).toBeUndefined();
    expect(parsed.storage).toBeUndefined();
    expect(parsed.fileCount).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'adapter',
      'found',
      'platform',
      'snapshotId',
      'timestamp',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
