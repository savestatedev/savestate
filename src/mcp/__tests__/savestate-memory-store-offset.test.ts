import { describe, expect, it } from 'vitest';
import { parseSavestateMemoryStoreOffset, selectSavestateMemoryStoreOffsetEntries } from '../savestate-memory-store-offset.js';

describe('MCP savestate_memory_store offset', () => {
  it('defaults to undefined', () => {
    expect(parseSavestateMemoryStoreOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseSavestateMemoryStoreOffset(0)).toBe(0);
    expect(parseSavestateMemoryStoreOffset(12)).toBe(12);
  });

  it.each([-1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSavestateMemoryStoreOffset(value)).toThrow(
      `Invalid offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseSavestateMemoryStoreOffset(1000)).toBe(1000);
    expect(() => parseSavestateMemoryStoreOffset(1001)).toThrow(
      'Invalid offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N confirmation field rows', () => {
    expect(
      selectSavestateMemoryStoreOffsetEntries(
        [{ key: 'id' }, { key: 'type' }, { key: 'tags' }],
        1,
      ).map((entry) => entry.key),
    ).toEqual(['type', 'tags']);
  });

  it('returns all rows when offset is omitted', () => {
    const entries = [{ key: 'id' }, { key: 'type' }];
    expect(selectSavestateMemoryStoreOffsetEntries(entries, undefined)).toEqual(entries);
  });
});
