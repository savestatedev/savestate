import { describe, expect, it } from 'vitest';
import {
  applyMemoryDemoteFilters,
  parseMemoryDemoteOffset,
  selectMemoryDemoteOffsetEntries,
} from '../memory.js';

describe('savestate memory demote --offset', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryDemoteOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseMemoryDemoteOffset('0')).toBe(0);
    expect(parseMemoryDemoteOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', '0x10', '1e2', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryDemoteOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseMemoryDemoteOffset('1000')).toBe(1000);
    expect(() => parseMemoryDemoteOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N status field rows', () => {
    expect(
      selectMemoryDemoteOffsetEntries(
        [{ id: 'status' }, { id: 'from' }, { id: 'to' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['from', 'to']);
  });

  it('returns all rows when offset is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'from' }];
    expect(selectMemoryDemoteOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips status field rows before --limit', () => {
    expect(
      applyMemoryDemoteFilters(
        [{ id: 'status' }, { id: 'from' }, { id: 'to' }],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['from']);
  });
});
