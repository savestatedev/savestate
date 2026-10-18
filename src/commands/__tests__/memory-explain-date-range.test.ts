import { describe, expect, it } from 'vitest';
import {
  filterMemoryExplainEntries,
  formatMemoryExplainFilterMatches,
  getMemoryExplainFilters,
} from '../memory.js';

const entries = [
  {
    id: 'mem-before',
    content: 'Before the window',
    createdAt: '2026-09-30T23:59:59.999Z',
    source: 'chatgpt',
  },
  {
    id: 'mem-boundary',
    content: 'On the window boundary',
    createdAt: '2026-10-01T23:59:59.999Z',
    source: 'chatgpt',
  },
  {
    id: 'mem-after',
    content: 'After the window',
    createdAt: '2026-10-02T00:00:00.000Z',
    source: 'chatgpt',
  },
];

describe('savestate memory explain creation-date filters', () => {
  it('applies inclusive date-only since and until boundaries', () => {
    expect(
      filterMemoryExplainEntries(entries, {
        since: '2026-10-01',
        until: '2026-10-01',
      }).map((entry) => entry.id),
    ).toEqual(['mem-boundary']);
  });

  it('preserves the active date filters for human and JSON consumers', () => {
    const options = { since: '2026-10-01', until: '2026-10-18' };

    expect(formatMemoryExplainFilterMatches(options)).toEqual([
      'since=2026-10-01',
      'until=2026-10-18',
    ]);
    expect(getMemoryExplainFilters(options)).toEqual(options);
  });
});
