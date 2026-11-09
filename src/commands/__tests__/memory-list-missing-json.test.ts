import { describe, expect, it } from 'vitest';
import {
  formatMemoryListMissingJson,
  type MemoryListMissingJson,
} from '../memory.js';

describe('savestate memory list --json when missing', () => {
  it('keeps contentIncluded explicit for a missing snapshot', () => {
    const parsed = JSON.parse(
      formatMemoryListMissingJson('ss-missing'),
    ) as MemoryListMissingJson & {
      entries?: unknown;
      byTier?: unknown;
      pinned?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      snapshot: 'ss-missing',
      total: 0,
      shown: 0,
      contentIncluded: true,
    });
    expect(parsed.entries).toBeUndefined();
    expect(parsed.byTier).toBeUndefined();
    expect(parsed.pinned).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['contentIncluded', 'found', 'shown', 'snapshot', 'total']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('marks missing summary responses as content-free when requested', () => {
    const parsed = JSON.parse(
      formatMemoryListMissingJson('ss-missing', { includeContent: false }),
    ) as MemoryListMissingJson;

    expect(parsed).toEqual({
      found: false,
      snapshot: 'ss-missing',
      total: 0,
      shown: 0,
      contentIncluded: false,
    });
  });
});
