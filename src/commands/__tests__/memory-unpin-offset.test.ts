import { describe, expect, it } from 'vitest';
import {
  applyMemoryUnpinFilters,
  parseMemoryUnpinOffset,
  selectMemoryUnpinOffsetEntries,
} from '../memory.js';

describe('savestate memory unpin --offset', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryUnpinOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseMemoryUnpinOffset('0')).toBe(0);
    expect(parseMemoryUnpinOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryUnpinOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseMemoryUnpinOffset('1000')).toBe(1000);
    expect(() => parseMemoryUnpinOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N status field rows', () => {
    expect(
      selectMemoryUnpinOffsetEntries(
        [{ id: 'status' }, { id: 'from' }, { id: 'to' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['from', 'to']);
  });

  it('returns all rows when offset is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'from' }];
    expect(selectMemoryUnpinOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips status field rows before --limit', () => {
    expect(
      applyMemoryUnpinFilters(
        [{ id: 'status' }, { id: 'from' }, { id: 'to' }],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['from']);
  });
});
