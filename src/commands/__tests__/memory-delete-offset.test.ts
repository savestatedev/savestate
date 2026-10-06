import { describe, expect, it } from 'vitest';
import {
  applyMemoryDeleteFilters,
  parseMemoryDeleteOffset,
  selectMemoryDeleteOffsetEntries,
} from '../memory-lifecycle.js';

describe('savestate memory delete --offset', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryDeleteOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseMemoryDeleteOffset('0')).toBe(0);
    expect(parseMemoryDeleteOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryDeleteOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseMemoryDeleteOffset('1000')).toBe(1000);
    expect(() => parseMemoryDeleteOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips status field rows before --limit', () => {
    const entries = [{ id: 'status' }, { id: 'id' }, { id: 'reason' }];
    expect(selectMemoryDeleteOffsetEntries(entries, 1).map((entry) => entry.id)).toEqual([
      'id',
      'reason',
    ]);
    expect(applyMemoryDeleteFilters(entries, { offset: '1', limit: '1' })).toEqual([
      { id: 'id' },
    ]);
  });

  it('returns all rows when offset is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'id' }];
    expect(selectMemoryDeleteOffsetEntries(entries, undefined)).toEqual(entries);
  });
});
