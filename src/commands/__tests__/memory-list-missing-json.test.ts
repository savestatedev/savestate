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
      filters: {
        tier: null,
        freshness: null,
        pinned: null,
        source: null,
        namespace: null,
        content: null,
        tags: null,
        until: null,
        since: null,
        importantFirst: false,
        oldestFirst: false,
      },
      contentIncluded: true,
    });
    expect(parsed.entries).toBeUndefined();
    expect(parsed.byTier).toBeUndefined();
    expect(parsed.pinned).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['contentIncluded', 'filters', 'found', 'limit', 'offset', 'shown', 'snapshot', 'total']);
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
      filters: {
        tier: null,
        freshness: null,
        pinned: null,
        source: null,
        namespace: null,
        content: null,
        tags: null,
        until: null,
        since: null,
        importantFirst: false,
        oldestFirst: false,
      },
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

  it('preserves normalized filters for missing snapshots', () => {
    const parsed = JSON.parse(formatMemoryListMissingJson('ss-missing', {
      filters: {
        source: '  ChatGPT  ',
        namespace: ' org:app:agent ',
        tags: ['work'],
        since: '2026-10-01',
        until: '2026-10-31',
        importantFirst: true,
      },
    })) as MemoryListMissingJson;

    expect(parsed.filters).toEqual({
      tier: null,
      freshness: null,
      pinned: null,
      source: 'ChatGPT',
      namespace: 'org:app:agent',
      content: null,
      tags: ['work'],
      until: '2026-10-31',
      since: '2026-10-01',
      importantFirst: true,
      oldestFirst: false,
    });
  });

  it('normalizes missing-snapshot tag filters like populated results', () => {
    const parsed = JSON.parse(formatMemoryListMissingJson('ss-missing', {
      filters: { tags: [' Work ', 'work', 'URGENT'] },
    })) as MemoryListMissingJson;

    expect(parsed.filters.tags).toEqual(['Work', 'URGENT']);
  });
});
