import { describe, expect, it } from 'vitest';
import type { MemoryEntry } from '../../types.js';
import {
  formatMemoryListJson,
  filterMemoryListByCreatedSince,
  filterMemoryListByNamespace,
  filterMemoryListByContent,
  filterMemoryListByTags,
  getMemoryListSummary,
  countByFreshness,
  type MemoryListJson,
} from '../memory.js';

function entry(partial: Partial<MemoryEntry> & Pick<MemoryEntry, 'id' | 'content'>): MemoryEntry {
  return {
    source: partial.source ?? 'user',
    createdAt: partial.createdAt ?? '2026-09-01T00:00:00.000Z',
    ...partial,
  };
}

describe('savestate memory --json', () => {
  it('filters entries by their metadata namespace', () => {
    const entries = [
      entry({ id: 'mem-a', content: 'a', metadata: { namespace: 'org:app:agent' } }),
      entry({ id: 'mem-b', content: 'b', metadata: { namespace: 'org:app:other' } }),
      entry({ id: 'mem-c', content: 'c' }),
    ];

    expect(filterMemoryListByNamespace(entries, 'org:app:agent').map(({ id }) => id)).toEqual(['mem-a']);
    expect(filterMemoryListByNamespace(entries)).toBe(entries);
  });

  it('matches namespaces after trimming legacy metadata and filter input', () => {
    const entries = [
      entry({ id: 'mem-padded', content: 'padded', metadata: { namespace: '  org:app:agent  ' } }),
      entry({ id: 'mem-other', content: 'other', metadata: { namespace: 'org:app:other' } }),
    ];

    expect(filterMemoryListByNamespace(entries, ' org:app:agent ')).toEqual([entries[0]]);
  });

  it('matches every requested tag after normalizing legacy metadata', () => {
    const entries = [
      entry({ id: 'mem-work', content: 'work', metadata: { tags: [' work ', 'urgent', 'urgent'] } }),
      entry({ id: 'mem-urgent', content: 'urgent', metadata: { tags: ['urgent'] } }),
      entry({ id: 'mem-untagged', content: 'untagged' }),
    ];

    expect(filterMemoryListByTags(entries, ['work', 'urgent']).map(({ id }) => id)).toEqual(['mem-work']);
    expect(filterMemoryListByTags(entries)).toBe(entries);
    const parsed = JSON.parse(formatMemoryListJson(entries, [entries[0]], {
      filters: { tags: ['work', 'urgent'] },
    })) as MemoryListJson;
    expect(parsed.filters.tags).toEqual(['work', 'urgent']);
    expect(parsed.entries[0].tags).toEqual(['work', 'urgent']);
  });

  it('deduplicates legacy tags case-insensitively while preserving the first label', () => {
    const tagged = entry({
      id: 'mem-case-tags',
      content: 'case tags',
      metadata: { tags: [' Work ', 'work', 'URGENT', 'urgent'] },
    });

    const parsed = JSON.parse(formatMemoryListJson([tagged], [tagged])) as MemoryListJson;
    expect(parsed.entries[0].tags).toEqual(['Work', 'URGENT']);
  });

  it('summarizes the filtered collection for table output too', () => {
    const filtered = [
      entry({ id: 'mem-l1', content: 'preference', tier: 'L1' }),
      entry({ id: 'mem-l1b', content: 'another preference', tier: 'L1' }),
    ];

    expect(getMemoryListSummary(filtered)).toEqual({
      counts: { L1: 2, L2: 0, L3: 0 },
      total: 2,
    });
  });

  it('counts freshness states using the same reference time as entry serialization', () => {
    const now = new Date('2026-10-01T00:00:00.000Z');
    const entries = [
      entry({ id: 'mem-active', content: 'active', lastVerifiedAt: '2026-09-30T00:00:00.000Z' }),
      entry({ id: 'mem-stale', content: 'stale', lastVerifiedAt: '2026-09-01T00:00:00.000Z' }),
      entry({ id: 'mem-confirm', content: 'confirm', lastVerifiedAt: '2026-01-01T00:00:00.000Z' }),
    ];

    expect(countByFreshness(entries, now)).toEqual({
      active: 1,
      stale: 1,
      needs_confirmation: 1,
    });
  });

  it('keeps freshness counts and entries consistent at a TTL boundary', () => {
    const now = new Date('2026-10-15T12:00:00.000Z');
    const entryAtBoundary = entry({
      id: 'mem-boundary',
      content: 'boundary',
      freshnessClass: 'fast',
      lastVerifiedAt: '2026-10-14T12:00:00.000Z',
    });

    const parsed = JSON.parse(formatMemoryListJson(
      [entryAtBoundary],
      [entryAtBoundary],
      { now },
    )) as MemoryListJson;

    expect(parsed.byFreshness).toEqual({ active: 0, stale: 0, needs_confirmation: 1 });
    expect(parsed.entries[0].freshness.state).toBe('needs_confirmation');
  });

  it('prints list summary and entries as JSON', () => {
    const all = [
      entry({ id: 'mem-l1', content: 'inbox preference', tier: 'L1', pinned: true }),
      entry({
        id: 'mem-l2',
        content: 'working note',
        tier: 'L2',
        source: 'agent',
        metadata: { namespace: 'org:app:agent' },
        updatedAt: '2026-09-02T12:00:00.000Z',
        lastAccessedAt: '2026-09-03T08:30:00.000Z',
        verificationSource: 'profile-sync',
      }),
      entry({ id: 'mem-l3', content: 'archive fact', createdAt: '2026-08-01T00:00:00.000Z' }),
    ];
    const parsed = JSON.parse(formatMemoryListJson(all, [all[0], all[1]])) as MemoryListJson;
    expect(parsed.found).toBe(true);
    expect(parsed.empty).toBe(false);
    expect(parsed.emptyReason).toBeNull();
    expect(parsed.total).toBe(3);
    expect(parsed.shown).toBe(2);
    expect(parsed.remaining).toBe(1);
    expect(parsed.offset).toBe(0);
    expect(parsed.limit).toBeNull();
    expect(parsed.pageSize).toBe(2);
    expect(parsed.hasPrevious).toBe(false);
    expect(parsed.previousOffset).toBeNull();
    expect(parsed.hasMore).toBe(true);
    expect(parsed.nextOffset).toBe(2);
    expect(parsed.suggestedOffset).toBeNull();
    expect(parsed.filters).toEqual({ tier: null, freshness: null, pinned: null, source: null, namespace: null, content: null, tags: null, until: null, since: null, oldestFirst: false });
    expect(parsed.byTier).toEqual({ L1: 1, L2: 1, L3: 1 });
    expect(parsed.shownByTier).toEqual({ L1: 1, L2: 1, L3: 0 });
    expect(parsed.byFreshness).toEqual({ active: 0, stale: 3, needs_confirmation: 0 });
    expect(parsed.shownByFreshness).toEqual({ active: 0, stale: 2, needs_confirmation: 0 });
    expect(parsed.pinned).toBe(1);
    expect(parsed.shownPinned).toBe(1);
    expect(parsed.entries).toEqual([
      {
        id: 'mem-l1',
        tier: 'L1',
        pinned: true,
        importance: 0.5,
        source: 'user',
        namespace: null,
        createdAt: '2026-09-01T00:00:00.000Z',
        content: 'inbox preference',
        freshness: {
          class: 'slow',
          state: 'stale',
          softTtlSeconds: 2592000,
          hardTtlSeconds: 15552000,
          staleBehavior: 'warn',
          lastVerifiedAt: '2026-09-01T00:00:00.000Z',
        },
      },
      {
        id: 'mem-l2',
        tier: 'L2',
        pinned: false,
        importance: 0.5,
        source: 'agent',
        namespace: 'org:app:agent',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-02T12:00:00.000Z',
        lastAccessedAt: '2026-09-03T08:30:00.000Z',
        content: 'working note',
        freshness: {
          class: 'slow',
          state: 'stale',
          softTtlSeconds: 2592000,
          hardTtlSeconds: 15552000,
          staleBehavior: 'warn',
          lastVerifiedAt: '2026-09-02T12:00:00.000Z',
          verificationSource: 'profile-sync',
        },
      },
    ]);
  });

  it('trims legacy source padding in JSON entries', () => {
    const legacy = entry({ id: 'legacy', content: 'legacy source', source: '  Claude-Code  ' });
    const parsed = JSON.parse(formatMemoryListJson([legacy], [legacy])) as MemoryListJson;

    expect(parsed.entries[0].source).toBe('Claude-Code');
  });

  it('records empty lists with zero counts', () => {
    const parsed = JSON.parse(formatMemoryListJson([], [])) as MemoryListJson;
    expect(parsed.found).toBe(true);
    expect(parsed.empty).toBe(true);
    expect(parsed.emptyReason).toBe('collection');
    expect(parsed.total).toBe(0);
    expect(parsed.shown).toBe(0);
    expect(parsed.remaining).toBe(0);
    expect(parsed.offset).toBe(0);
    expect(parsed.hasMore).toBe(false);
    expect(parsed.hasPrevious).toBe(false);
    expect(parsed.previousOffset).toBeNull();
    expect(parsed.nextOffset).toBeNull();
    expect(parsed.suggestedOffset).toBeNull();
    expect(parsed.filters).toEqual({ tier: null, freshness: null, pinned: null, source: null, namespace: null, content: null, tags: null, until: null, since: null, oldestFirst: false });
    expect(parsed.byTier).toEqual({ L1: 0, L2: 0, L3: 0 });
    expect(parsed.shownByTier).toEqual({ L1: 0, L2: 0, L3: 0 });
    expect(parsed.byFreshness).toEqual({ active: 0, stale: 0, needs_confirmation: 0 });
    expect(parsed.shownByFreshness).toEqual({ active: 0, stale: 0, needs_confirmation: 0 });
    expect(parsed.pinned).toBe(0);
    expect(parsed.shownPinned).toBe(0);
    expect(parsed.entries).toEqual([]);
  });

  it('exposes the continuation offset for filtered pages', () => {
    const all = [
      entry({ id: 'mem-l1', content: 'first', tier: 'L1' }),
      entry({ id: 'mem-l2', content: 'second', tier: 'L2' }),
      entry({ id: 'mem-l3', content: 'third', tier: 'L3' }),
    ];
    const parsed = JSON.parse(
      formatMemoryListJson(all, [all[1]], { offset: 1, limit: 1, hasMore: true }),
    ) as MemoryListJson;

    expect(parsed.offset).toBe(1);
    expect(parsed.limit).toBe(1);
    expect(parsed.remaining).toBe(1);
    expect(parsed.pageSize).toBe(1);
    expect(parsed.hasPrevious).toBe(true);
    expect(parsed.previousOffset).toBe(0);
    expect(parsed.hasMore).toBe(true);
    expect(parsed.nextOffset).toBe(2);
  });

  it('summarizes the filtered collection rather than the backing store', () => {
    const filtered = [
      entry({ id: 'mem-l1', content: 'pinned preference', tier: 'L1', pinned: true }),
      entry({ id: 'mem-l1b', content: 'another preference', tier: 'L1' }),
    ];
    const parsed = JSON.parse(
      formatMemoryListJson(filtered, [filtered[0]], { offset: 0, hasMore: true }),
    ) as MemoryListJson;

    expect(parsed.total).toBe(2);
    expect(parsed.hasPrevious).toBe(false);
    expect(parsed.previousOffset).toBeNull();
    expect(parsed.byTier).toEqual({ L1: 2, L2: 0, L3: 0 });
    expect(parsed.pinned).toBe(1);
    expect(parsed.nextOffset).toBe(1);
  });

  it('reports pinned counts for both the filtered collection and page', () => {
    const all = [
      entry({ id: 'mem-page', content: 'page result' }),
      entry({ id: 'mem-next', content: 'next result', pinned: true }),
    ];
    const parsed = JSON.parse(
      formatMemoryListJson(all, [all[0]], { offset: 0, limit: 1, hasMore: true }),
    ) as MemoryListJson;

    expect(parsed.pinned).toBe(1);
    expect(parsed.shownPinned).toBe(0);
  });

  it('reports active list filters for automation', () => {
    const all = [
      entry({ id: 'mem-l1', content: 'pinned preference', tier: 'L1', pinned: true }),
    ];
    const parsed = JSON.parse(
      formatMemoryListJson(all, all, {
        filters: { tier: 'L1', freshness: null, pinned: true, source: 'agent', namespace: 'org:app:agent', oldestFirst: true },
      }),
    ) as MemoryListJson;

    expect(parsed.filters).toEqual({ tier: 'L1', freshness: null, pinned: true, source: 'agent', namespace: 'org:app:agent', content: null, tags: null, until: null, since: null, oldestFirst: true });
  });

  it('filters content case-insensitively and reports the active filter', () => {
    const entries = [
      entry({ id: 'mem-a', content: 'Preferred EDITOR: vim' }),
      entry({ id: 'mem-b', content: 'Preferred shell: zsh' }),
    ];
    expect(filterMemoryListByContent(entries, 'editor').map(({ id }) => id)).toEqual(['mem-a']);
    const parsed = JSON.parse(formatMemoryListJson(entries, [entries[0]], {
      filters: { content: 'editor' },
    })) as MemoryListJson;
    expect(parsed.filters.content).toBe('editor');
  });

  it('reports the active creation cutoff', () => {
    const entries = [entry({ id: 'mem-a', content: 'older' })];
    const parsed = JSON.parse(formatMemoryListJson(entries, entries, {
      filters: { until: '2026-10-01' },
    })) as MemoryListJson;
    expect(parsed.filters.until).toBe('2026-10-01');
  });

  it('filters by creation start and reports the active filter', () => {
    const entries = [
      entry({ id: 'mem-old', content: 'old', createdAt: '2026-09-30T23:59:59.999Z' }),
      entry({ id: 'mem-day', content: 'day', createdAt: '2026-10-01T00:00:00.000Z' }),
      entry({ id: 'mem-new', content: 'new', createdAt: '2026-10-02T00:00:00.000Z' }),
    ];
    expect(filterMemoryListByCreatedSince(entries, '2026-10-01').map(({ id }) => id)).toEqual([
      'mem-day',
      'mem-new',
    ]);
    const parsed = JSON.parse(formatMemoryListJson(entries.slice(1), entries.slice(1), {
      filters: { since: '2026-10-01' },
    })) as MemoryListJson;
    expect(parsed.filters.since).toBe('2026-10-01');
  });

  it('uses the page size when calculating the previous offset', () => {
    const all = [
      entry({ id: 'mem-1', content: 'first' }),
      entry({ id: 'mem-2', content: 'second' }),
      entry({ id: 'mem-3', content: 'third' }),
      entry({ id: 'mem-4', content: 'fourth' }),
    ];
    const parsed = JSON.parse(
      formatMemoryListJson(all, [all[2], all[3]], { offset: 2, limit: 2 }),
    ) as MemoryListJson;

    expect(parsed.hasPrevious).toBe(true);
    expect(parsed.previousOffset).toBe(0);
  });

  it('backs up by one item for an empty unbounded page', () => {
    const parsed = JSON.parse(
      formatMemoryListJson([{ id: 'mem-1', content: 'first' } as MemoryEntry], [], { offset: 2 }),
    ) as MemoryListJson;

    expect(parsed.previousOffset).toBe(1);
    expect(parsed.remaining).toBe(0);
    expect(parsed.emptyReason).toBe('page');
    expect(parsed.suggestedOffset).toBe(0);
  });

  it('suggests the start for an empty unbounded page with multiple entries', () => {
    const parsed = JSON.parse(
      formatMemoryListJson(
        [
          { id: 'mem-1', content: 'first' },
          { id: 'mem-2', content: 'second' },
        ] as MemoryEntry[],
        [],
        { offset: 2 },
      ),
    ) as MemoryListJson;

    expect(parsed.suggestedOffset).toBe(0);
  });

  it('advances empty bounded pages by their requested page size', () => {
    const parsed = JSON.parse(
      formatMemoryListJson(
        [{ id: 'mem-1', content: 'first' } as MemoryEntry],
        [],
        { offset: 2, limit: 10, hasMore: true },
      ),
    ) as MemoryListJson;

    expect(parsed.nextOffset).toBe(12);
    expect(parsed.suggestedOffset).toBe(0);
  });

  it('points exhausted bounded pages to the nearest populated page', () => {
    const all = Array.from({ length: 45 }, (_, index) =>
      entry({ id: `mem-${index + 1}`, content: `memory ${index + 1}` }),
    );
    const parsed = JSON.parse(
      formatMemoryListJson(all, [], { offset: 100, limit: 20 }),
    ) as MemoryListJson;

    expect(parsed.emptyReason).toBe('page');
    expect(parsed.hasPrevious).toBe(true);
    expect(parsed.previousOffset).toBe(40);
    expect(parsed.suggestedOffset).toBe(40);
  });

  it('advances sparse bounded pages by their requested page size', () => {
    const entries = [
      { id: 'mem-1', content: 'first' },
      { id: 'mem-2', content: 'second' },
      { id: 'mem-3', content: 'third' },
    ] as MemoryEntry[];
    const parsed = JSON.parse(
      formatMemoryListJson(entries, [entries[0], entries[1], entries[2]], {
        offset: 10,
        limit: 10,
        hasMore: true,
      }),
    ) as MemoryListJson;

    expect(parsed.nextOffset).toBe(20);
  });
});
