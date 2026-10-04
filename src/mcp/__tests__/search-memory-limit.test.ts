import { describe, expect, it } from 'vitest';
import { parseSearchMemoryLimit, selectSearchMemoryEntries } from '../search-memory-limit.js';

describe('MCP search_memory limit', () => {
  it('defaults to undefined', () => {
    expect(parseSearchMemoryLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseSearchMemoryLimit(12)).toBe(12);
  });

  it.each([0, -1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSearchMemoryLimit(value)).toThrow(
      `Invalid limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSearchMemoryLimit(1000)).toBe(1000);
    expect(() => parseSearchMemoryLimit(1001)).toThrow(
      'Invalid limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N memories', () => {
    expect(
      selectSearchMemoryEntries(
        [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['m1', 'm2']);
  });

  it('returns all memories when limit is omitted', () => {
    const entries = [{ id: 'm1' }, { id: 'm2' }];
    expect(selectSearchMemoryEntries(entries, undefined)).toEqual(entries);
  });
});
