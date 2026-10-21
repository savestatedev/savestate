import { describe, expect, it } from 'vitest';
import {
  formatMemoryListJson,
  formatMemoryListNamespace,
  formatMemoryListPageSummary,
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
});
