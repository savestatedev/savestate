import { describe, expect, it } from 'vitest';
import {
  applyMemoryExplainFilters,
  formatMemoryExplainEmptyMessage,
  formatMemoryExplainPrettySummary,
  parseMemoryExplainOffset,
  selectMemoryExplainOffsetEntries,
} from '../memory.js';

describe('savestate memory explain --offset', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryExplainOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseMemoryExplainOffset('0')).toBe(0);
    expect(parseMemoryExplainOffset('12')).toBe(12);
    expect(parseMemoryExplainOffset(' 12 ')).toBe(12);
  });

  it.each(['-1', '1.5', '1e2', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryExplainOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseMemoryExplainOffset('1000')).toBe(1000);
    expect(() => parseMemoryExplainOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N retrieval results', () => {
    expect(
      selectMemoryExplainOffsetEntries(
        [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['m2', 'm3']);
  });

  it('returns all results when offset is omitted', () => {
    const entries = [{ id: 'm1' }, { id: 'm2' }];
    expect(selectMemoryExplainOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips retrieval results before --limit', () => {
    expect(
      applyMemoryExplainFilters(
        [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['m2']);
  });

  it('summarizes a visible page and its continuation', () => {
    expect(formatMemoryExplainPrettySummary(2, 5, { offset: 2, pageSize: 2 })).toBe(
      'Showing 3-4 of 5 relevant memories. Previous page: use --offset 0 --limit 2. Next page: use --offset 4 --limit 2.',
    );
  });

  it('summarizes the previous page when a result page is not the first page', () => {
    expect(formatMemoryExplainPrettySummary(1, 3, { offset: 2, pageSize: 2 })).toBe(
      'Showing 3-3 of 3 relevant memories. Previous page: use --offset 0 --limit 2.',
    );
  });

  it('distinguishes an empty page from no matching memories', () => {
    expect(formatMemoryExplainPrettySummary(0, 5, { offset: 10 })).toContain(
      'No memories on this page',
    );
    expect(formatMemoryExplainPrettySummary(0, 5, { offset: 10, pageSize: 2 })).toBe(
      'No memories on this page (offset 10; 5 relevant memories matched). ' +
      'Try --offset 4 to open the nearest available page.',
    );
    expect(formatMemoryExplainPrettySummary(0, 0)).toBe('No memories matched the query.');
    expect(formatMemoryExplainEmptyMessage(5)).toBe('No memories are visible on this page.');
    expect(formatMemoryExplainEmptyMessage(0)).toBe('No memories matched the query.');
  });
});
