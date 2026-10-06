import { describe, expect, it } from 'vitest';
import {
  applyMemoryConfigFilters,
  parseMemoryConfigOffset,
  selectMemoryConfigOffsetEntries,
} from '../memory.js';

describe('savestate memory config --offset', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryConfigOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseMemoryConfigOffset('0')).toBe(0);
    expect(parseMemoryConfigOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryConfigOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseMemoryConfigOffset('1000')).toBe(1000);
    expect(() => parseMemoryConfigOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N configuration setting rows', () => {
    expect(
      selectMemoryConfigOffsetEntries(
        [{ id: 'version' }, { id: 'defaultTier' }, { id: 'l1.maxItems' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['defaultTier', 'l1.maxItems']);
  });

  it('returns all rows when offset is omitted', () => {
    const entries = [{ id: 'version' }, { id: 'defaultTier' }];
    expect(selectMemoryConfigOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips configuration setting rows before --limit', () => {
    expect(
      applyMemoryConfigFilters(
        [{ id: 'version' }, { id: 'defaultTier' }, { id: 'l1.maxItems' }],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['defaultTier']);
  });
});
