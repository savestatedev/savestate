import { describe, expect, it } from 'vitest';
import {
  formatMemoryListJson,
  formatMemoryListNamespace,
  formatMemoryListNamespaceSummary,
  formatMemoryListPageNamespaceSummary,
  formatMemoryListPageSummary,
  formatMemoryListPageTagSummary,
  formatMemoryListTagSummary,
  shouldShowMemoryListNamespace,
} from '../memory.js';
import type { MemoryEntry } from '../../types.js';

const memory = (namespace?: string): MemoryEntry => ({
  id: 'memory-1',
  content: 'content',
  source: 'test',
  createdAt: '2026-01-01T00:00:00.000Z',
  metadata: namespace === undefined ? undefined : { namespace },
});

describe('savestate memory list namespace display', () => {
  it('does not add a namespace column for blank namespaces', () => {
    expect(shouldShowMemoryListNamespace([memory('  '), memory()])).toBe(false);
  });

  it('trims namespace labels before displaying them', () => {
    expect(formatMemoryListNamespace('  org:app:agent  ')).toBe('org:app:agent');
    expect(formatMemoryListNamespace('   ')).toBe('—');
  });

  it('normalizes namespace labels in JSON output', () => {
    const output = JSON.parse(formatMemoryListJson(
      [memory('  org:app:agent  '), memory('   ')],
      [memory('  org:app:agent  '), memory('   ')],
      { snapshot: 'ss-2026-01-01' },
    ));

    expect(output.snapshot).toBe('ss-2026-01-01');
    expect(output.entries.map((entry: { namespace: string | null }) => entry.namespace)).toEqual([
      'org:app:agent',
      null,
    ]);
  });

  it('summarizes namespaces for the collection and visible page', () => {
    const entries = [
      memory(' Org:App:Agent '),
      { ...memory('org:app:agent'), id: 'memory-2' },
      { ...memory('org:app:other'), id: 'memory-3' },
      { ...memory('  '), id: 'memory-4' },
    ];

    expect(formatMemoryListNamespaceSummary(entries)).toBe(
      'Org:App:Agent 2, org:app:other 1, 1 unassigned',
    );
    expect(formatMemoryListPageNamespaceSummary(entries.slice(0, 2))).toBe(
      'Page Namespaces: Org:App:Agent 2',
    );
  });

  it('reports unassigned memories when no namespace is present', () => {
    expect(formatMemoryListNamespaceSummary([
      memory(''),
      { ...memory('  '), id: 'memory-2' },
    ])).toBe('2 unassigned');
  });
});

describe('savestate memory list table pagination summary', () => {
  it('omits the summary when every matching memory is shown', () => {
    expect(formatMemoryListPageSummary(2, 2)).toBe('');
  });

  it('describes bounded pages', () => {
    expect(formatMemoryListPageSummary(7, 3, 3, 3)).toBe(
      '(showing 3 of 7 matching memories; offset 3, limit 3; next offset 6; previous offset 0)',
    );
  });

  it('describes an unbounded page that starts after an offset', () => {
    expect(formatMemoryListPageSummary(7, 4, 3)).toBe(
      '(showing 4 of 7 matching memories; offset 3; previous offset 0)',
    );
  });

  it('points to the next unbounded page when rows remain', () => {
    expect(formatMemoryListPageSummary(7, 2, 3)).toBe(
      '(showing 2 of 7 matching memories; offset 3; next offset 5; previous offset 1)',
    );
  });

  it('points exhausted unbounded pages back to the start', () => {
    expect(formatMemoryListPageSummary(7, 0, 100)).toBe(
      '(showing 0 of 7 matching memories; offset 100; previous offset 0)',
    );
  });

  it('points exhausted bounded pages to the nearest available page', () => {
    expect(formatMemoryListPageSummary(45, 0, 100, 20)).toBe(
      '(showing 0 of 45 matching memories; offset 100, limit 20; previous offset 40)',
    );
  });

  it('keeps stale JSON pages terminal even when callers pass hasMore', () => {
    const parsed = JSON.parse(formatMemoryListJson(
      [memory(), memory('other')],
      [],
      { offset: 10, limit: 2, hasMore: true },
    ));

    expect(parsed).toMatchObject({
      empty: true,
      emptyReason: 'page',
      hasMore: false,
      nextOffset: null,
      suggestedOffset: 0,
      guidance: { action: 'retry', offset: 0 },
    });
  });
});

describe('savestate memory list tag summary', () => {
  it('formats tags for the visible page', () => {
    expect(formatMemoryListPageTagSummary([
      { ...memory(), metadata: { tags: [' Work ', 'urgent'] } },
      { ...memory(), id: 'memory-2', metadata: { tags: ['work'] } },
    ])).toBe('Page Tags: urgent 1, Work 2');
  });

  it('normalizes, sorts, and counts tags', () => {
    expect(formatMemoryListTagSummary([
      memory(),
      { ...memory(), id: 'memory-2', metadata: { tags: [' Work ', 'urgent'] } },
      { ...memory(), id: 'memory-3', metadata: { tags: ['work'] } },
    ])).toBe('urgent 1, Work 2');
  });

  it('reports when no memory has tags', () => {
    expect(formatMemoryListTagSummary([memory(), memory('  ')] )).toBe('none');
  });
});
