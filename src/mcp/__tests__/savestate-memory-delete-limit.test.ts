import { describe, expect, it } from 'vitest';
import { parseSavestateMemoryDeleteLimit, selectSavestateMemoryDeleteEntries } from '../savestate-memory-delete-limit.js';

describe('MCP savestate_memory_delete limit', () => {
  it('defaults to undefined', () => {
    expect(parseSavestateMemoryDeleteLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseSavestateMemoryDeleteLimit(12)).toBe(12);
  });

  it.each([0, -1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSavestateMemoryDeleteLimit(value)).toThrow(
      `Invalid limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSavestateMemoryDeleteLimit(1000)).toBe(1000);
    expect(() => parseSavestateMemoryDeleteLimit(1001)).toThrow(
      'Invalid limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N confirmation field rows', () => {
    expect(
      selectSavestateMemoryDeleteEntries(
        [{ key: 'id' }, { key: 'status' }, { key: 'deleted' }],
        2,
      ).map((entry) => entry.key),
    ).toEqual(['id', 'status']);
  });

  it('returns all rows when limit is omitted', () => {
    const entries = [{ key: 'id' }, { key: 'status' }];
    expect(selectSavestateMemoryDeleteEntries(entries, undefined)).toEqual(entries);
  });
});
