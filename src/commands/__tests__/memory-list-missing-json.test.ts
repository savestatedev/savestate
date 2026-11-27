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
      empty: true,
      emptyReason: 'snapshot',
      total: 0,
      shown: 0,
      remaining: 0,
      limit: null,
      offset: 0,
      maxOffset: 1000,
      pageSize: 0,
      totalPages: 0,
      lastPage: 0,
      lastPageOffset: null,
      hasMore: false,
      isLastPage: true,
      nextOffset: null,
      previousOffset: null,
      suggestedOffset: null,
      guidance: { action: 'none', offset: null },
      ordering: {
        primary: 'createdAt',
        direction: 'desc',
        tieBreaker: 'id',
        tieDirection: 'asc',
        finalTieBreaker: 'id',
      },
      importance: { min: null, max: null, average: null },
      shownImportance: { min: null, max: null, average: null },
      byTier: { L1: 0, L2: 0, L3: 0 },
      shownByTier: { L1: 0, L2: 0, L3: 0 },
      bySource: {},
      shownBySource: {},
      byFreshness: { active: 0, stale: 0, needs_confirmation: 0 },
      shownByFreshness: { active: 0, stale: 0, needs_confirmation: 0 },
      freshnessPercentages: { active: 0, stale: 0, needs_confirmation: 0 },
      shownFreshnessPercentages: { active: 0, stale: 0, needs_confirmation: 0 },
      byNamespace: {},
      shownByNamespace: {},
      namespacePercentages: {},
      shownNamespacePercentages: {},
      unassignedNamespaceCount: 0,
      shownUnassignedNamespaceCount: 0,
      byTag: {},
      shownByTag: {},
      tagPercentages: {},
      shownTagPercentages: {},
      sourcePercentages: {},
      shownSourcePercentages: {},
      pinned: 0,
      shownPinned: 0,
      pinnedPercentage: 0,
      shownPinnedPercentage: 0,
      filters: {
        tier: null,
        freshness: null,
        pinned: null,
        source: null,
        namespace: null,
        unassignedNamespace: false,
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
    expect(parsed.byTier).toEqual({ L1: 0, L2: 0, L3: 0 });
    expect(parsed.pinned).toBe(0);
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['byFreshness', 'byNamespace', 'bySource', 'byTag', 'byTier', 'contentIncluded', 'empty', 'emptyReason', 'filters', 'found', 'freshnessPercentages', 'guidance', 'hasMore', 'importance', 'isLastPage', 'lastPage', 'lastPageOffset', 'limit', 'maxOffset', 'namespacePercentages', 'nextOffset', 'offset', 'ordering', 'pageSize', 'pinned', 'pinnedPercentage', 'previousOffset', 'remaining', 'shown', 'shownByFreshness', 'shownByNamespace', 'shownBySource', 'shownByTag', 'shownByTier', 'shownFreshnessPercentages', 'shownImportance', 'shownNamespacePercentages', 'shownPinned', 'shownPinnedPercentage', 'shownSourcePercentages', 'shownTagPercentages', 'shownUnassignedNamespaceCount', 'snapshot', 'sourcePercentages', 'suggestedOffset', 'tagPercentages', 'total', 'totalPages', 'unassignedNamespaceCount']);
    expect(parsed.lastPage).toBe(0);
    expect(parsed.byFreshness).toEqual({ active: 0, stale: 0, needs_confirmation: 0 });
    expect(parsed.shownByFreshness).toEqual({ active: 0, stale: 0, needs_confirmation: 0 });
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('marks missing summary responses as content-free when requested', () => {
    const parsed = JSON.parse(
      formatMemoryListMissingJson('ss-missing', { includeContent: false }),
    ) as MemoryListMissingJson;

    expect(parsed).toEqual({
      found: false,
      snapshot: 'ss-missing',
      empty: true,
      emptyReason: 'snapshot',
      total: 0,
      shown: 0,
      remaining: 0,
      limit: null,
      offset: 0,
      maxOffset: 1000,
      pageSize: 0,
      totalPages: 0,
      lastPage: 0,
      lastPageOffset: null,
      hasMore: false,
      isLastPage: true,
      nextOffset: null,
      previousOffset: null,
      suggestedOffset: null,
      guidance: { action: 'none', offset: null },
      ordering: {
        primary: 'createdAt',
        direction: 'desc',
        tieBreaker: 'id',
        tieDirection: 'asc',
        finalTieBreaker: 'id',
      },
      importance: { min: null, max: null, average: null },
      shownImportance: { min: null, max: null, average: null },
      byTier: { L1: 0, L2: 0, L3: 0 },
      shownByTier: { L1: 0, L2: 0, L3: 0 },
      bySource: {},
      shownBySource: {},
      byFreshness: { active: 0, stale: 0, needs_confirmation: 0 },
      shownByFreshness: { active: 0, stale: 0, needs_confirmation: 0 },
      freshnessPercentages: { active: 0, stale: 0, needs_confirmation: 0 },
      shownFreshnessPercentages: { active: 0, stale: 0, needs_confirmation: 0 },
      byNamespace: {},
      shownByNamespace: {},
      namespacePercentages: {},
      shownNamespacePercentages: {},
      unassignedNamespaceCount: 0,
      shownUnassignedNamespaceCount: 0,
      byTag: {},
      shownByTag: {},
      tagPercentages: {},
      shownTagPercentages: {},
      sourcePercentages: {},
      shownSourcePercentages: {},
      pinned: 0,
      shownPinned: 0,
      pinnedPercentage: 0,
      shownPinnedPercentage: 0,
      filters: {
        tier: null,
        freshness: null,
        pinned: null,
        source: null,
        namespace: null,
        unassignedNamespace: false,
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

  it('marks missing snapshots as terminal for paginated consumers', () => {
    const parsed = JSON.parse(
      formatMemoryListMissingJson('ss-missing', { limit: 25, offset: 50 }),
    ) as MemoryListMissingJson;

    expect(parsed.guidance).toEqual({ action: 'none', offset: null });
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
        unassignedNamespace: true,
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
      unassignedNamespace: true,
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

  it('sanitizes invalid pagination values like populated results', () => {
    const parsed = JSON.parse(formatMemoryListMissingJson('ss-missing', {
      limit: Number.NaN,
      offset: -4,
    })) as MemoryListMissingJson;

    expect(parsed.limit).toBeNull();
    expect(parsed.offset).toBe(0);
  });

  it('floors valid pagination values for stable JSON metadata', () => {
    const parsed = JSON.parse(formatMemoryListMissingJson('ss-missing', {
      limit: 2.9,
      offset: 4.8,
    })) as MemoryListMissingJson;

    expect(parsed.limit).toBe(2);
    expect(parsed.offset).toBe(4);
  });
});
