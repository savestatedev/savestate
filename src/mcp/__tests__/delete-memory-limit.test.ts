import { describe, expect, it } from 'vitest';
import { parseDeleteMemoryLimit, selectDeleteMemoryEntries } from '../delete-memory-limit.js';

describe('MCP delete_memory limit', () => {
  it('defaults to undefined', () => {
    expect(parseDeleteMemoryLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseDeleteMemoryLimit(12)).toBe(12);
  });

  it.each([0, -1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseDeleteMemoryLimit(value)).toThrow(
      `Invalid limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseDeleteMemoryLimit(1000)).toBe(1000);
    expect(() => parseDeleteMemoryLimit(1001)).toThrow(
      'Invalid limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N confirmation field rows', () => {
    expect(
      selectDeleteMemoryEntries(
        [{ key: 'id' }, { key: 'status' }, { key: 'deleted' }],
        2,
      ).map((entry) => entry.key),
    ).toEqual(['id', 'status']);
  });

  it('returns all rows when limit is omitted', () => {
    const entries = [{ key: 'id' }, { key: 'status' }];
    expect(selectDeleteMemoryEntries(entries, undefined)).toEqual(entries);
  });
});
