import { describe, expect, it } from 'vitest';
import { parseSavestateMemoryDeleteOffset, selectSavestateMemoryDeleteOffsetEntries } from '../savestate-memory-delete-offset.js';

describe('MCP savestate_memory_delete offset', () => {
  it('defaults to undefined', () => {
    expect(parseSavestateMemoryDeleteOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseSavestateMemoryDeleteOffset(0)).toBe(0);
    expect(parseSavestateMemoryDeleteOffset(12)).toBe(12);
  });

  it.each([-1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSavestateMemoryDeleteOffset(value)).toThrow(
      `Invalid offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseSavestateMemoryDeleteOffset(1000)).toBe(1000);
    expect(() => parseSavestateMemoryDeleteOffset(1001)).toThrow(
      'Invalid offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N confirmation field rows', () => {
    expect(
      selectSavestateMemoryDeleteOffsetEntries(
        [{ key: 'id' }, { key: 'status' }, { key: 'hint' }],
        1,
      ).map((entry) => entry.key),
    ).toEqual(['status', 'hint']);
  });

  it('returns all rows when offset is omitted', () => {
    const entries = [{ key: 'id' }, { key: 'status' }];
    expect(selectSavestateMemoryDeleteOffsetEntries(entries, undefined)).toEqual(entries);
  });
});
