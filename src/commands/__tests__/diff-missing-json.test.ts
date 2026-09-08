import { describe, expect, it } from 'vitest';
import {
  formatDiffMissingJson,
  type DiffMissingJson,
} from '../diff.js';

describe('savestate diff --json when missing', () => {
  it('prints a missing snapshot summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatDiffMissingJson('ss-a', 'ss-b')) as DiffMissingJson & {
      identity?: unknown;
      state?: unknown;
      filename?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      snapshotA: 'ss-a',
      snapshotB: 'ss-b',
      hasChanges: false,
    });
    expect(parsed.identity).toBeUndefined();
    expect(parsed.state).toBeUndefined();
    expect(parsed.filename).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'found',
      'hasChanges',
      'snapshotA',
      'snapshotB',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
