import { describe, expect, it } from 'vitest';
import {
  applyMemoryEditFilters,
  parseMemoryEditOffset,
  selectMemoryEditOffsetEntries,
} from '../memory-lifecycle.js';

describe('savestate memory edit --offset', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryEditOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseMemoryEditOffset('0')).toBe(0);
    expect(parseMemoryEditOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', '0x10', ' ', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryEditOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseMemoryEditOffset('1000')).toBe(1000);
    expect(() => parseMemoryEditOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N status field rows', () => {
    expect(
      selectMemoryEditOffsetEntries(
        [{ id: 'status' }, { id: 'id' }, { id: 'version' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['id', 'version']);
  });

  it('returns all rows when offset is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'id' }];
    expect(selectMemoryEditOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips status field rows before --limit', () => {
    expect(
      applyMemoryEditFilters(
        [{ id: 'status' }, { id: 'id' }, { id: 'version' }],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['id']);
  });
});
