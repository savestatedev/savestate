import { describe, expect, it } from 'vitest';
import {
  applyMemoryListFilters,
  parseMemoryListOffset,
  selectMemoryListOffsetEntries,
} from '../memory.js';

describe('savestate memory list --offset', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryListOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseMemoryListOffset('0')).toBe(0);
    expect(parseMemoryListOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryListOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseMemoryListOffset('1000')).toBe(1000);
    expect(() => parseMemoryListOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N memories', () => {
    expect(
      selectMemoryListOffsetEntries(
        [{ id: 'mem-1' }, { id: 'mem-2' }, { id: 'mem-3' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['mem-2', 'mem-3']);
  });

  it('returns all memories when offset is omitted', () => {
    const entries = [{ id: 'mem-1' }, { id: 'mem-2' }];
    expect(selectMemoryListOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips memories before --limit', () => {
    expect(
      applyMemoryListFilters(
        [{ id: 'mem-1' }, { id: 'mem-2' }, { id: 'mem-3' }],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['mem-2']);
  });
});
