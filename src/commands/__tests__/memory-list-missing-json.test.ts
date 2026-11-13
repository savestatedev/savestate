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
      limit: null,
      offset: 0,
      contentIncluded: true,
    });
    expect(parsed.entries).toBeUndefined();
    expect(parsed.byTier).toBeUndefined();
    expect(parsed.pinned).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['contentIncluded', 'found', 'limit', 'offset', 'shown', 'snapshot', 'total']);
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
      limit: null,
      offset: 0,
      contentIncluded: false,
    });
  });

  it('preserves a requested page size for missing snapshots', () => {
    const parsed = JSON.parse(
      formatMemoryListMissingJson('ss-missing', { limit: 25 }),
    ) as MemoryListMissingJson;

    expect(parsed.limit).toBe(25);
  });

  it('preserves a requested offset for missing snapshots', () => {
    const parsed = JSON.parse(
      formatMemoryListMissingJson('ss-missing', { offset: 50 }),
    ) as MemoryListMissingJson;

    expect(parsed.offset).toBe(50);
  });
});
