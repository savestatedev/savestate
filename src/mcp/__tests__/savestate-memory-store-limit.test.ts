import { describe, expect, it } from 'vitest';
import { parseSavestateMemoryStoreLimit, selectSavestateMemoryStoreEntries } from '../savestate-memory-store-limit.js';

describe('MCP savestate_memory_store limit', () => {
  it('defaults to undefined', () => {
    expect(parseSavestateMemoryStoreLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseSavestateMemoryStoreLimit(12)).toBe(12);
  });

  it.each([0, -1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSavestateMemoryStoreLimit(value)).toThrow(
      `Invalid limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSavestateMemoryStoreLimit(1000)).toBe(1000);
    expect(() => parseSavestateMemoryStoreLimit(1001)).toThrow(
      'Invalid limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N confirmation field rows', () => {
    expect(
      selectSavestateMemoryStoreEntries(
        [{ key: 'id' }, { key: 'type' }, { key: 'tags' }],
        2,
      ).map((entry) => entry.key),
    ).toEqual(['id', 'type']);
  });

  it('returns all rows when limit is omitted', () => {
    const entries = [{ key: 'id' }, { key: 'type' }];
    expect(selectSavestateMemoryStoreEntries(entries, undefined)).toEqual(entries);
  });
});
