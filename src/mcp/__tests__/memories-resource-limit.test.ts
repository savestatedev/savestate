import { describe, expect, it } from 'vitest';
import { parseMemoriesResourceLimit, selectMemoriesResourceEntries } from '../memories-resource-limit.js';

describe('MCP savestate://memories limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoriesResourceLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMemoriesResourceLimit(12)).toBe(12);
  });

  it.each([0, -1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseMemoriesResourceLimit(value)).toThrow(
      `Invalid limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMemoriesResourceLimit(1000)).toBe(1000);
    expect(() => parseMemoriesResourceLimit(1001)).toThrow(
      'Invalid limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N memories', () => {
    expect(
      selectMemoriesResourceEntries(
        [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['m1', 'm2']);
  });

  it('returns all memories when limit is omitted', () => {
    const entries = [{ id: 'm1' }, { id: 'm2' }];
    expect(selectMemoriesResourceEntries(entries, undefined)).toEqual(entries);
  });
});
