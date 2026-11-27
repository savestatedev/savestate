import { describe, expect, it } from 'vitest';
import type { MemoryEntry } from '../../types.js';
import {
  formatMemoryListJson,
  normalizeMemoryListContent,
  filterMemoryListByCreatedSince,
  filterMemoryListBySource,
  filterMemoryListByNamespace,
  filterMemoryListByUnassignedNamespace,
  filterMemoryExplainEntries,
  filterMemoryListByContent,
  filterMemoryListByTags,
  getMemoryListSummary,
  countByFreshness,
  getMemoryListFreshnessPercentages,
  countBySource,
  getMemoryListSourcePercentages,
  countByNamespace,
  getMemoryListNamespacePercentages,
  countByTag,
  normalizeMemoryListNamespace,
  formatMemoryListOrderingSummary,
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
  it('reports freshness percentages for the matching collection and visible page', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    const entries = [
      entry({ id: 'mem-active', content: 'active', freshnessClass: 'fast', lastVerifiedAt: '2026-09-09T23:00:00.000Z' }),
      entry({ id: 'mem-stale', content: 'stale', freshnessClass: 'medium', lastVerifiedAt: '2026-09-01T00:00:00.000Z' }),
      entry({ id: 'mem-confirm', content: 'confirm', freshnessClass: 'slow', lastVerifiedAt: '2026-01-01T00:00:00.000Z' }),
    ];

    expect(getMemoryListFreshnessPercentages(entries, now)).toMatchObject({
      active: expect.closeTo(100 / 3),
      stale: expect.closeTo(100 / 3),
      needs_confirmation: expect.closeTo(100 / 3),
    });

    const parsed = JSON.parse(formatMemoryListJson(entries, entries.slice(0, 2), { now })) as MemoryListJson;
    expect(parsed.freshnessPercentages).toMatchObject({
      active: expect.closeTo(100 / 3),
      stale: expect.closeTo(100 / 3),
      needs_confirmation: expect.closeTo(100 / 3),
    });
    expect(parsed.shownFreshnessPercentages).toEqual({ active: 50, stale: 50, needs_confirmation: 0 });
  });

  it('describes the active human-readable list ordering', () => {
    expect(formatMemoryListOrderingSummary()).toBe('Ordering: newest first (ties by id)');
    expect(formatMemoryListOrderingSummary(true)).toBe('Ordering: oldest first (ties by id)');
    expect(formatMemoryListOrderingSummary(false, true))
      .toBe('Ordering: highest importance first (ties newest first, then id)');
    expect(formatMemoryListOrderingSummary(true, true))
      .toBe('Ordering: highest importance first (ties oldest first, then id)');
  });

  it('reports important-first ordering in the normalized filter envelope', () => {
    const memory = entry({ id: 'mem-important', content: 'important', metadata: { importance: 0.9 } });
    const parsed = JSON.parse(formatMemoryListJson([memory], [memory], {
      filters: { importantFirst: true },
    })) as MemoryListJson;

    expect(parsed.filters.importantFirst).toBe(true);
  });

  it('reports importance aggregates for the matching collection and visible page', () => {
    const entries = [
      entry({ id: 'mem-high', content: 'high', metadata: { importance: 0.9 } }),
      entry({ id: 'mem-default', content: 'default' }),
      entry({ id: 'mem-low', content: 'low', metadata: { importance: 0.1 } }),
    ];
    const parsed = JSON.parse(formatMemoryListJson(entries, entries.slice(0, 2))) as MemoryListJson;

    expect(parsed.importance).toEqual({ min: 0.1, max: 0.9, average: 0.5 });
    expect(parsed.shownImportance).toEqual({ min: 0.5, max: 0.9, average: 0.7 });
  });

  it('uses null importance aggregates for an empty collection or page', () => {
    const parsed = JSON.parse(formatMemoryListJson([], [])) as MemoryListJson;

    expect(parsed.importance).toEqual({ min: null, max: null, average: null });
    expect(parsed.shownImportance).toEqual({ min: null, max: null, average: null });
    expect(parsed.pinnedPercentage).toBe(0);
    expect(parsed.shownPinnedPercentage).toBe(0);
  });

  it('reports the stable ordering contract for machine consumers', () => {
    const memory = entry({ id: 'mem-a', content: 'a', createdAt: '2026-09-01T00:00:00.000Z' });
    const parsed = JSON.parse(formatMemoryListJson([memory], [memory], {
      filters: { importantFirst: true, oldestFirst: true },
    })) as MemoryListJson;

    expect(parsed.ordering).toEqual({
      primary: 'importance',
      direction: 'desc',
      tieBreaker: 'createdAt',
      tieDirection: 'asc',
      finalTieBreaker: 'id',
    });
  });

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

  it('matches namespaces case-insensitively', () => {
    const entries = [
      entry({ id: 'mem-upper', content: 'upper', metadata: { namespace: 'Org:App:Agent' } }),
      entry({ id: 'mem-other', content: 'other', metadata: { namespace: 'org:app:other' } }),
    ];

    expect(filterMemoryListByNamespace(entries, 'ORG:APP:AGENT')).toEqual([entries[0]]);
  });

  it('lets explain target only memories without a namespace', () => {
    const entries = [
      entry({ id: 'mem-assigned', content: 'shared preference', metadata: { namespace: 'org:app:agent' } }),
      entry({ id: 'mem-unassigned', content: 'shared preference' }),
      entry({ id: 'mem-blank', content: 'shared preference', metadata: { namespace: '  ' } }),
    ];

    expect(filterMemoryExplainEntries(entries, { unassigned: true }).map(({ id }) => id))
      .toEqual(['mem-unassigned', 'mem-blank']);
    expect(filterMemoryListByUnassignedNamespace(entries, true).map(({ id }) => id))
      .toEqual(['mem-unassigned', 'mem-blank']);
  });

  it('normalizes padded namespaces in JSON filters', () => {
    const parsed = JSON.parse(formatMemoryListJson([], [], {
      filters: { namespace: '  org:app:agent  ' },
    })) as MemoryListJson;

    expect(normalizeMemoryListNamespace('  org:app:agent  ')).toBe('org:app:agent');
    expect(parsed.filters.namespace).toBe('org:app:agent');
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

  it('normalizes active tag filters at the JSON output boundary', () => {
    const tagged = entry({ id: 'mem-filter-tags', content: 'filter tags' });

    const parsed = JSON.parse(formatMemoryListJson([tagged], [tagged], {
      filters: { tags: [' Work ', 'work', 'URGENT', ' '] },
    })) as MemoryListJson;

    expect(parsed.filters.tags).toEqual(['Work', 'URGENT']);
  });

  it('reports blank-only tag filters as inactive in JSON', () => {
    const parsed = JSON.parse(formatMemoryListJson([], [], {
      filters: { tags: [' ', '\t'] },
    })) as MemoryListJson;

    expect(parsed.filters.tags).toBeNull();
  });

  it('ignores blank and duplicate tag filters during retrieval', () => {
    const entries = [
      entry({ id: 'mem-work', content: 'work', metadata: { tags: ['Work'] } }),
      entry({ id: 'mem-other', content: 'other', metadata: { tags: ['Other'] } }),
    ];

    expect(filterMemoryListByTags(entries, [' Work ', 'work', ' '])).toEqual([entries[0]]);
    expect(filterMemoryListByTags(entries, [' '])).toEqual(entries);
  });

  it('keeps content and tag matching independent of the host locale', () => {
    const entries = [entry({
      id: 'mem-locale-stable',
      content: 'I prefer a terminal workflow',
      metadata: { tags: ['CLI'] },
    })];

    expect(filterMemoryListByContent(entries, 'i prefer')).toEqual(entries);
    expect(filterMemoryListByTags(entries, ['cli'])).toEqual(entries);
  });

  it('matches content across imported whitespace', () => {
    const entries = [
      entry({ id: 'mem-formatted', content: 'I prefer a\nlocal\teditor' }),
      entry({ id: 'mem-other', content: 'Remote workflows are fine' }),
    ];

    expect(filterMemoryListByContent(entries, 'prefer a local editor').map(({ id }) => id))
      .toEqual(['mem-formatted']);
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

  it('counts normalized source labels for the full collection and visible page', () => {
    const all = [
      entry({ id: 'mem-a', content: 'a', source: 'Claude-Code' }),
      entry({ id: 'mem-b', content: 'b', source: ' claude-code ' }),
      entry({ id: 'mem-c', content: 'c', source: 'user' }),
    ];

    expect(countBySource(all)).toEqual({ 'Claude-Code': 2, user: 1 });

    const parsed = JSON.parse(formatMemoryListJson(all, all.slice(0, 2))) as MemoryListJson;
    expect(parsed.bySource).toEqual({ 'Claude-Code': 2, user: 1 });
    expect(parsed.shownBySource).toEqual({ 'Claude-Code': 2 });
    expect(parsed.sourcePercentages['Claude-Code']).toBeCloseTo(66.6666667);
    expect(parsed.sourcePercentages.user).toBeCloseTo(33.3333333);
    expect(parsed.shownSourcePercentages).toEqual({ 'Claude-Code': 100 });
  });

  it('reports namespace shares for the full collection and visible page', () => {
    const all = [
      entry({ id: 'mem-a', content: 'a', metadata: { namespace: 'Org:App' } }),
      entry({ id: 'mem-b', content: 'b', metadata: { namespace: 'org:app' } }),
      entry({ id: 'mem-c', content: 'c', metadata: { namespace: 'other' } }),
      entry({ id: 'mem-d', content: 'd' }),
    ];

    expect(getMemoryListNamespacePercentages(all)).toEqual({ 'Org:App': 50, other: 25 });
    const parsed = JSON.parse(formatMemoryListJson(all, all.slice(0, 2))) as MemoryListJson;
    expect(parsed.namespacePercentages).toEqual({ 'Org:App': 50, other: 25 });
    expect(parsed.shownNamespacePercentages).toEqual({ 'Org:App': 100 });
  });

  it('returns an empty source distribution for an empty collection', () => {
    expect(getMemoryListSourcePercentages([])).toEqual({});
  });

  it('keeps source aggregate keys stable when entry order changes', () => {
    const entries = [
      entry({ id: 'mem-user', content: 'user', source: 'user' }),
      entry({ id: 'mem-claude', content: 'claude', source: 'Claude-Code' }),
    ];

    expect(countBySource(entries)).toEqual({ 'Claude-Code': 1, user: 1 });
    expect(JSON.parse(formatMemoryListJson(entries, entries)).bySource)
      .toEqual({ 'Claude-Code': 1, user: 1 });
  });

  it('keeps source aggregate casing stable when legacy entries disagree', () => {
    const upper = entry({ id: 'mem-upper', content: 'upper', source: 'Claude-Code' });
    const lower = entry({ id: 'mem-lower', content: 'lower', source: 'claude-code' });

    expect(countBySource([upper, lower])).toEqual({ 'Claude-Code': 2 });
    expect(countBySource([lower, upper])).toEqual({ 'Claude-Code': 2 });
  });

  it('counts normalized namespaces for the full collection and visible page', () => {
    const entries = [
      entry({ id: 'mem-a', content: 'a', metadata: { namespace: 'Org:App:Agent' } }),
      entry({ id: 'mem-b', content: 'b', metadata: { namespace: ' org:app:agent ' } }),
      entry({ id: 'mem-c', content: 'c', metadata: { namespace: 'org:app:other' } }),
      entry({ id: 'mem-d', content: 'd' }),
    ];

    expect(countByNamespace(entries)).toEqual({
      'Org:App:Agent': 2,
      'org:app:other': 1,
    });

    const parsed = JSON.parse(formatMemoryListJson(entries, entries.slice(0, 2))) as MemoryListJson;
    expect(parsed.byNamespace).toEqual({
      'Org:App:Agent': 2,
      'org:app:other': 1,
    });
    expect(parsed.shownByNamespace).toEqual({ 'Org:App:Agent': 2 });
    expect(parsed.unassignedNamespaceCount).toBe(1);
    expect(parsed.shownUnassignedNamespaceCount).toBe(0);
  });

  it('sorts namespace aggregates without case-sensitive surprises', () => {
    const entries = [
      entry({ id: 'mem-zeta', content: 'zeta', metadata: { namespace: 'Zeta' } }),
      entry({ id: 'mem-alpha', content: 'alpha', metadata: { namespace: 'alpha' } }),
    ];

    expect(countByNamespace(entries)).toEqual({ alpha: 1, Zeta: 1 });
  });

  it('counts normalized tags for the full collection and visible page', () => {
    const entries = [
      entry({ id: 'mem-a', content: 'a', metadata: { tags: [' Work ', 'urgent'] } }),
      entry({ id: 'mem-b', content: 'b', metadata: { tags: ['work', 'other'] } }),
    ];

    expect(countByTag(entries)).toEqual({ other: 1, urgent: 1, Work: 2 });
    const parsed = JSON.parse(formatMemoryListJson(entries, entries.slice(0, 1))) as MemoryListJson;
    expect(parsed.byTag).toEqual({ other: 1, urgent: 1, Work: 2 });
    expect(parsed.shownByTag).toEqual({ urgent: 1, Work: 1 });
  });

  it('counts a duplicated tag once per memory', () => {
    const entries = [
      entry({ id: 'mem-a', content: 'a', metadata: { tags: ['work', ' Work ', 'WORK'] } }),
      entry({ id: 'mem-b', content: 'b', metadata: { tags: ['work'] } }),
    ];

    expect(countByTag(entries)).toEqual({ work: 2 });
  });

  it('keeps tag aggregate keys stable when archive order changes', () => {
    const first = [
      entry({ id: 'mem-a', content: 'a', metadata: { tags: ['work'] } }),
      entry({ id: 'mem-b', content: 'b', metadata: { tags: [' Work '] } }),
    ];
    const reverse = [...first].reverse();

    expect(countByTag(first)).toEqual({ Work: 2 });
    expect(countByTag(reverse)).toEqual({ Work: 2 });
  });

  it('uses a stable representative when tag casing varies by archive order', () => {
    const entries = [
      entry({ id: 'mem-lower', content: 'lower', metadata: { tags: ['alpha'] } }),
      entry({ id: 'mem-upper', content: 'upper', metadata: { tags: ['Alpha'] } }),
    ];

    expect(countByTag(entries)).toEqual({ Alpha: 2 });
    expect(countByTag([...entries].reverse())).toEqual({ Alpha: 2 });
  });

  it('keeps reserved tag names as ordinary aggregate keys', () => {
    const entries = [
      entry({ id: 'mem-proto', content: 'proto', metadata: { tags: ['__proto__'] } }),
      entry({ id: 'mem-constructor', content: 'constructor', metadata: { tags: ['constructor'] } }),
    ];

    expect(countByTag(entries)).toEqual(Object.fromEntries([
      ['__proto__', 1],
      ['constructor', 1],
    ]));
  });

  it('uses locale-independent source keys for aggregates and filters', () => {
    const entries = [
      entry({ id: 'mem-source-a', content: 'a', source: '  Claude-Code  ' }),
      entry({ id: 'mem-source-b', content: 'b', source: 'claude-code' }),
    ];

    expect(countBySource(entries)).toEqual({ 'Claude-Code': 2 });
    expect(filterMemoryListBySource(entries, 'CLAUDE-CODE')).toEqual(entries);
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
    expect(parsed.contentIncluded).toBe(true);
    expect(parsed.entries[0].freshness.state).toBe('needs_confirmation');
    expect(parsed.entries[0].freshnessClass).toBe('fast');
    expect(parsed.entries[0].lastVerifiedAt).toBe('2026-10-14T12:00:00.000Z');
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
    expect(parsed.page).toBe(1);
    expect(parsed.totalPages).toBe(1);
    expect(parsed.hasPrevious).toBe(false);
    expect(parsed.previousOffset).toBeNull();
    expect(parsed.previousPage).toBeNull();
    expect(parsed.hasMore).toBe(true);
    expect(parsed.isLastPage).toBe(false);
    expect(parsed.nextOffset).toBe(2);
    expect(parsed.nextPage).toBe(2);
    expect(parsed.suggestedOffset).toBeNull();
    expect(parsed.guidance).toEqual({ action: 'next', offset: 2 });
    expect(parsed.filters).toEqual({ tier: null, freshness: null, pinned: null, source: null, namespace: null, unassignedNamespace: false, content: null, tags: null, until: null, since: null, importantFirst: false, oldestFirst: false });
    expect(parsed.filterSummary).toBeNull();
    expect(parsed.byTier).toEqual({ L1: 1, L2: 1, L3: 1 });
    expect(parsed.shownByTier).toEqual({ L1: 1, L2: 1, L3: 0 });
    expect(parsed.bySource).toEqual({ user: 2, agent: 1 });
    expect(parsed.shownBySource).toEqual({ user: 1, agent: 1 });
    expect(parsed.sourcePercentages).toEqual({ agent: 33.33333333333333, user: 66.66666666666666 });
    expect(parsed.shownSourcePercentages).toEqual({ agent: 50, user: 50 });
    expect(parsed.byFreshness).toEqual({ active: 0, stale: 3, needs_confirmation: 0 });
    expect(parsed.shownByFreshness).toEqual({ active: 0, stale: 2, needs_confirmation: 0 });
    expect(parsed.pinned).toBe(1);
    expect(parsed.shownPinned).toBe(1);
    expect(parsed.pinnedPercentage).toBeCloseTo(33.333333);
    expect(parsed.shownPinnedPercentage).toBe(50);
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
        freshnessClass: 'slow',
        lastVerifiedAt: '2026-09-01T00:00:00.000Z',
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
        freshnessClass: 'slow',
        lastVerifiedAt: '2026-09-02T12:00:00.000Z',
        verificationSource: 'profile-sync',
      },
    ]);
  });

  it('stops pagination at the supported offset ceiling', () => {
    const all = Array.from({ length: 1101 }, (_, index) => entry({
      id: `mem-${index}`,
      content: `memory ${index}`,
    }));
    const parsed = JSON.parse(formatMemoryListJson(all, all.slice(896, 1024), {
      offset: 896,
      limit: 128,
    })) as MemoryListJson;

    expect(parsed.lastPageOffset).toBe(896);
    expect(parsed.lastPage).toBe(8);
    expect(parsed.hasMore).toBe(false);
    expect(parsed.isLastPage).toBe(true);
    expect(parsed.nextOffset).toBeNull();
    expect(parsed.guidance).toEqual({ action: 'previous', offset: 768 });
  });

  it('normalizes the source filter alongside serialized source entries', () => {
    const legacy = entry({ id: 'mem-source', content: 'source', source: '  Claude-Code  ' });

    const parsed = JSON.parse(formatMemoryListJson([legacy], [legacy], {
      filters: { source: '  Claude-Code  ' },
    })) as MemoryListJson;

    expect(parsed.filters.source).toBe('Claude-Code');
    expect(parsed.entries[0].source).toBe('Claude-Code');
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
    expect(parsed.pageSize).toBe(0);
    expect(parsed.hasMore).toBe(false);
    expect(parsed.isLastPage).toBe(true);
    expect(parsed.hasPrevious).toBe(false);
    expect(parsed.previousOffset).toBeNull();
    expect(parsed.nextOffset).toBeNull();
    expect(parsed.page).toBe(0);
    expect(parsed.totalPages).toBe(0);
    expect(parsed.lastPage).toBe(0);
    expect(parsed.suggestedOffset).toBeNull();
    expect(parsed.guidance).toEqual({ action: 'none', offset: null });
    expect(parsed.filters).toEqual({ tier: null, freshness: null, pinned: null, source: null, namespace: null, unassignedNamespace: false, content: null, tags: null, until: null, since: null, importantFirst: false, oldestFirst: false });
    expect(parsed.byTier).toEqual({ L1: 0, L2: 0, L3: 0 });
    expect(parsed.shownByTier).toEqual({ L1: 0, L2: 0, L3: 0 });
    expect(parsed.bySource).toEqual({});
    expect(parsed.shownBySource).toEqual({});
    expect(parsed.sourcePercentages).toEqual({});
    expect(parsed.shownSourcePercentages).toEqual({});
    expect(parsed.byFreshness).toEqual({ active: 0, stale: 0, needs_confirmation: 0 });
    expect(parsed.shownByFreshness).toEqual({ active: 0, stale: 0, needs_confirmation: 0 });
    expect(parsed.pinned).toBe(0);
    expect(parsed.shownPinned).toBe(0);
    expect(parsed.entries).toEqual([]);
  });

  it('treats an empty filtered collection as terminal at a stale offset', () => {
    const parsed = JSON.parse(
      formatMemoryListJson([], [], { offset: 20, limit: 10, hasMore: true }),
    ) as MemoryListJson;

    expect(parsed.emptyReason).toBe('collection');
    expect(parsed.page).toBe(0);
    expect(parsed.totalPages).toBe(0);
    expect(parsed.hasPrevious).toBe(false);
    expect(parsed.previousOffset).toBeNull();
    expect(parsed.hasMore).toBe(false);
    expect(parsed.nextOffset).toBeNull();
    expect(parsed.guidance).toEqual({ action: 'none', offset: null });
  });

  it('clamps negative formatter offsets before calculating navigation', () => {
    const entries = [
      entry({ id: 'mem-first', content: 'first' }),
      entry({ id: 'mem-second', content: 'second' }),
    ];
    const parsed = JSON.parse(
      formatMemoryListJson(entries, entries.slice(0, 1), { offset: -5, limit: 1 }),
    ) as MemoryListJson;

    expect(parsed.offset).toBe(0);
    expect(parsed.page).toBe(1);
    expect(parsed.totalPages).toBe(2);
    expect(parsed.previousOffset).toBeNull();
    expect(parsed.nextOffset).toBe(1);
  });

  it('normalizes non-finite and fractional formatter offsets', () => {
    const entries = [
      entry({ id: 'mem-first', content: 'first' }),
      entry({ id: 'mem-second', content: 'second' }),
    ];

    const nonFinite = JSON.parse(
      formatMemoryListJson(entries, entries.slice(0, 1), { offset: Number.POSITIVE_INFINITY, limit: 1 }),
    ) as MemoryListJson;
    expect(nonFinite.offset).toBe(0);
    expect(nonFinite.page).toBe(1);
    expect(nonFinite.nextOffset).toBe(1);

    const fractional = JSON.parse(
      formatMemoryListJson(entries, entries.slice(1), { offset: 1.9, limit: 1 }),
    ) as MemoryListJson;
    expect(fractional.offset).toBe(1);
    expect(fractional.page).toBe(2);
    expect(fractional.previousOffset).toBe(0);
  });

  it('ignores invalid direct formatter limits before calculating navigation', () => {
    const entries = [
      entry({ id: 'mem-first', content: 'first' }),
      entry({ id: 'mem-second', content: 'second' }),
    ];
    const parsed = JSON.parse(
      formatMemoryListJson(entries, entries, { offset: 0, limit: 0 }),
    ) as MemoryListJson;

    expect(parsed.limit).toBeNull();
    expect(parsed.page).toBe(1);
    expect(parsed.totalPages).toBe(1);
    expect(parsed.hasMore).toBe(false);
    expect(parsed.nextOffset).toBeNull();
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
    expect(parsed.page).toBe(2);
    expect(parsed.totalPages).toBe(3);
    expect(parsed.hasPrevious).toBe(true);
    expect(parsed.previousOffset).toBe(0);
    expect(parsed.previousPage).toBe(1);
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
        filters: { tier: 'L1', freshness: null, pinned: true, source: 'agent', namespace: 'org:app:agent', importantFirst: false, oldestFirst: true },
      }),
    ) as MemoryListJson;

    expect(parsed.filters).toEqual({ tier: 'L1', freshness: null, pinned: true, source: 'agent', namespace: 'org:app:agent', unassignedNamespace: false, content: null, tags: null, until: null, since: null, importantFirst: false, oldestFirst: true });
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

  it('keeps empty bounded pages terminal while suggesting recovery', () => {
    const parsed = JSON.parse(
      formatMemoryListJson(
        [{ id: 'mem-1', content: 'first' } as MemoryEntry],
        [],
        { offset: 2, limit: 10, hasMore: true },
      ),
    ) as MemoryListJson;

    expect(parsed.nextOffset).toBeNull();
    expect(parsed.suggestedOffset).toBe(0);
    expect(parsed.guidance).toEqual({ action: 'retry', offset: 0 });
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
    expect(parsed.guidance).toEqual({ action: 'retry', offset: 40 });
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

  it('supports a content-free JSON summary for metadata consumers', () => {
    const memory = entry({ id: 'mem-summary', content: 'private preference', source: 'agent' });
    const parsed = JSON.parse(formatMemoryListJson([memory], [memory], {
      includeContent: false,
      snapshot: 'ss-summary',
    })) as MemoryListJson;

    expect(parsed.snapshot).toBe('ss-summary');
    expect(parsed.entries[0]).toMatchObject({
      id: 'mem-summary',
      source: 'agent',
    });
    expect(parsed.entries[0].content).toBeUndefined();
    expect(parsed.contentIncluded).toBe(false);
    expect(parsed.total).toBe(1);
    expect(parsed.shown).toBe(1);
    expect(parsed.guidance).toEqual({ action: 'none', offset: null });
  });

  it('includes the normalized filter summary for machine consumers', () => {
    const memory = entry({ id: 'mem-filter-summary', content: 'editor', source: 'Claude-Code' });
    const parsed = JSON.parse(formatMemoryListJson([memory], [memory], {
      filters: {
        source: ' claude-code ',
        tags: [' Work ', 'work'],
        minImportance: 0.8,
      },
    })) as MemoryListJson;

    expect(parsed.filterSummary).toBe('source=claude-code, tags=[Work], min-importance=0.8');
  });

  it('normalizes content filters in the JSON envelope', () => {
    const memory = entry({ id: 'mem-editor', content: 'preferred editor: vim' });
    const parsed = JSON.parse(formatMemoryListJson([memory], [memory], {
      filters: { content: '  preferred\n editor:   vim  ' },
    })) as MemoryListJson;

    expect(normalizeMemoryListContent('  preferred\n editor:   vim  ')).toBe('preferred editor: vim');
    expect(parsed.filters.content).toBe('preferred editor: vim');
  });
});
