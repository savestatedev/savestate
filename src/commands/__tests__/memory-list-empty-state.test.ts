import { describe, expect, it } from 'vitest';
import { formatMemoryListEmptyState, formatMemoryListFilterSummary } from '../memory.js';

describe('savestate memory list human empty state', () => {
  it('explains when no memories match the filters', () => {
    expect(formatMemoryListEmptyState(0, 0)).toBe(
      'No memories found matching the criteria. Try adjusting the filters.',
    );
  });

  it('includes active filters in an empty filtered collection', () => {
    const filters = formatMemoryListFilterSummary({
      tier: 'L1',
      pinned: true,
      source: 'agent',
      content: 'preferred editor',
      tags: ['work', 'urgent'],
    });

    expect(filters).toBe('tier=L1, pinned, source=agent, content="preferred editor", tags=[work, urgent]');
    expect(formatMemoryListEmptyState(0, 0, undefined, false, undefined, filters)).toBe(
      'No memories found matching these filters: tier=L1, pinned, source=agent, content="preferred editor", tags=[work, urgent]. Try adjusting the filters.',
    );
  });

  it('normalizes source and namespace values in the filter summary', () => {
    expect(formatMemoryListFilterSummary({
      source: '  agent  ',
      namespace: '  work  ',
    })).toBe('source=agent, namespace=work');
  });

  it('keeps multiline filter values on one CLI output line', () => {
    expect(formatMemoryListFilterSummary({
      source: 'agent\nteam',
      namespace: 'org:\tapp',
      content: 'preferred\neditor',
      tags: ['work\nurgent', '  personal  '],
      since: '2026-10-01\n00:00Z',
      until: '2026-10-31\t23:59Z',
    })).toBe('source=agent team, namespace=org: app, content="preferred editor", tags=[work urgent, personal], since=2026-10-01 00:00Z, until=2026-10-31 23:59Z');
  });

  it('omits blank filter values from the empty-state summary', () => {
    expect(formatMemoryListFilterSummary({
      source: '  ',
      namespace: '',
      content: '  ',
      tags: [' ', '\t'],
      since: '  ',
      until: '\n',
    })).toBeUndefined();
  });

  it('explains how to populate an empty snapshot', () => {
    expect(formatMemoryListEmptyState(0, 0, 20, true)).toBe(
      'No memories found in this snapshot. Capture or import memories to populate this list.',
    );

    expect(formatMemoryListEmptyState(0, 0, 20, true, 'ss-empty-2026-10-17')).toBe(
      'No memories found in snapshot ss-empty-2026-10-17. Capture or import memories to populate this list.',
    );
  });

  it('keeps active filters visible when the snapshot itself is empty', () => {
    expect(formatMemoryListEmptyState(
      0,
      0,
      20,
      true,
      'ss-empty-2026-10-17',
      'tier=L1, pinned',
    )).toBe(
      'No memories found in snapshot ss-empty-2026-10-17 matching these filters: tier=L1, pinned. Capture or import memories to populate this list.',
    );
  });

  it('explains when an offset skips past matching memories', () => {
    expect(formatMemoryListEmptyState(1, 1)).toBe(
      'No memories shown: offset 1 skips past 1 matching memory. Try --offset 0 to open the nearest available page.',
    );
    expect(formatMemoryListEmptyState(45, 100, 20)).toBe(
      'No memories shown: offset 100 skips past 45 matching memories. Try --offset 40 to open the nearest available page.',
    );
  });

  it('keeps active filters visible when an offset skips past matches', () => {
    expect(formatMemoryListEmptyState(
      3,
      10,
      2,
      false,
      undefined,
      'tier=L1, pinned',
    )).toBe(
      'No memories shown: offset 10 skips past 3 matching memories for these filters: tier=L1, pinned. ' +
      'Try --offset 2 to open the nearest available page.',
    );
  });

  it('returns to the start for an empty unbounded page', () => {
    expect(formatMemoryListEmptyState(45, 100)).toBe(
      'No memories shown: offset 100 skips past 45 matching memories. Try --offset 0 to open the nearest available page.',
    );
  });
});
