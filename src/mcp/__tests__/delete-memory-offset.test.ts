import { describe, expect, it } from 'vitest';
import { parseDeleteMemoryOffset, selectDeleteMemoryOffsetEntries } from '../delete-memory-offset.js';

describe('MCP delete_memory offset', () => {
  it('defaults to undefined', () => {
    expect(parseDeleteMemoryOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseDeleteMemoryOffset(0)).toBe(0);
    expect(parseDeleteMemoryOffset(12)).toBe(12);
  });

  it.each([-1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseDeleteMemoryOffset(value)).toThrow(
      `Invalid offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseDeleteMemoryOffset(1000)).toBe(1000);
    expect(() => parseDeleteMemoryOffset(1001)).toThrow(
      'Invalid offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N confirmation field rows', () => {
    expect(
      selectDeleteMemoryOffsetEntries(
        [{ key: 'id' }, { key: 'status' }, { key: 'deleted' }],
        1,
      ).map((entry) => entry.key),
    ).toEqual(['status', 'deleted']);
  });

  it('returns all rows when offset is omitted', () => {
    const entries = [{ key: 'id' }, { key: 'status' }];
    expect(selectDeleteMemoryOffsetEntries(entries, undefined)).toEqual(entries);
  });
});
