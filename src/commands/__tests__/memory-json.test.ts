import { describe, expect, it } from 'vitest';
import type { MemoryEntry } from '../../types.js';
import {
  formatMemoryListJson,
  filterMemoryListByNamespace,
  filterMemoryListByContent,
  getMemoryListSummary,
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
      }),
      entry({ id: 'mem-l3', content: 'archive fact', createdAt: '2026-08-01T00:00:00.000Z' }),
    ];
    const parsed = JSON.parse(formatMemoryListJson(all, [all[0], all[1]])) as MemoryListJson;
    expect(parsed.found).toBe(true);
    expect(parsed.empty).toBe(false);
    expect(parsed.emptyReason).toBeNull();
    expect(parsed.total).toBe(3);
    expect(parsed.shown).toBe(2);
    expect(parsed.offset).toBe(0);
    expect(parsed.limit).toBeNull();
    expect(parsed.pageSize).toBe(2);
    expect(parsed.hasPrevious).toBe(false);
    expect(parsed.previousOffset).toBeNull();
    expect(parsed.hasMore).toBe(true);
    expect(parsed.nextOffset).toBe(2);
    expect(parsed.suggestedOffset).toBeNull();
    expect(parsed.filters).toEqual({ tier: null, pinned: null, source: null, namespace: null, content: null, oldestFirst: false });
    expect(parsed.byTier).toEqual({ L1: 1, L2: 1, L3: 1 });
    expect(parsed.shownByTier).toEqual({ L1: 1, L2: 1, L3: 0 });
    expect(parsed.pinned).toBe(1);
    expect(parsed.shownPinned).toBe(1);
    expect(parsed.entries).toEqual([
      {
        id: 'mem-l1',
        tier: 'L1',
        pinned: true,
        source: 'user',
        namespace: null,
        createdAt: '2026-09-01T00:00:00.000Z',
        content: 'inbox preference',
      },
      {
        id: 'mem-l2',
        tier: 'L2',
        pinned: false,
        source: 'agent',
        namespace: 'org:app:agent',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-02T12:00:00.000Z',
        lastAccessedAt: '2026-09-03T08:30:00.000Z',
        content: 'working note',
      },
    ]);
  });

  it('records empty lists with zero counts', () => {
    const parsed = JSON.parse(formatMemoryListJson([], [])) as MemoryListJson;
    expect(parsed.found).toBe(true);
    expect(parsed.empty).toBe(true);
    expect(parsed.emptyReason).toBe('collection');
    expect(parsed.total).toBe(0);
    expect(parsed.shown).toBe(0);
    expect(parsed.offset).toBe(0);
    expect(parsed.hasMore).toBe(false);
    expect(parsed.hasPrevious).toBe(false);
    expect(parsed.previousOffset).toBeNull();
    expect(parsed.nextOffset).toBeNull();
    expect(parsed.suggestedOffset).toBeNull();
    expect(parsed.filters).toEqual({ tier: null, pinned: null, source: null, namespace: null, content: null, oldestFirst: false });
    expect(parsed.byTier).toEqual({ L1: 0, L2: 0, L3: 0 });
    expect(parsed.shownByTier).toEqual({ L1: 0, L2: 0, L3: 0 });
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
        filters: { tier: 'L1', pinned: true, source: 'agent', namespace: 'org:app:agent', oldestFirst: true },
      }),
    ) as MemoryListJson;

    expect(parsed.filters).toEqual({ tier: 'L1', pinned: true, source: 'agent', namespace: 'org:app:agent', content: null, oldestFirst: true });
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
