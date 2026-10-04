import { describe, expect, it } from 'vitest';
import {
  parseSavestateMemorySearchOffset,
  selectSavestateMemorySearchOffsetEntries,
} from '../savestate-memory-search-offset.js';

describe('MCP savestate_memory_search offset', () => {
  it('defaults to undefined', () => {
    expect(parseSavestateMemorySearchOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseSavestateMemorySearchOffset(0)).toBe(0);
    expect(parseSavestateMemorySearchOffset(12)).toBe(12);
  });

  it.each([-1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSavestateMemorySearchOffset(value)).toThrow(
      `Invalid offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseSavestateMemorySearchOffset(1000)).toBe(1000);
    expect(() => parseSavestateMemorySearchOffset(1001)).toThrow(
      'Invalid offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N memories', () => {
    expect(
      selectSavestateMemorySearchOffsetEntries(
        [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['m2', 'm3']);
  });

  it('returns all memories when offset is omitted', () => {
    const entries = [{ id: 'm1' }, { id: 'm2' }];
    expect(selectSavestateMemorySearchOffsetEntries(entries, undefined)).toEqual(entries);
  });
});
