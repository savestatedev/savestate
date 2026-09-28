import { describe, expect, it } from 'vitest';
import { parseMemoryConfigLimit, selectMemoryConfigEntries } from '../memory.js';

describe('savestate memory config --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryConfigLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMemoryConfigLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryConfigLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMemoryConfigLimit('1000')).toBe(1000);
    expect(() => parseMemoryConfigLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N configuration setting rows', () => {
    expect(
      selectMemoryConfigEntries(
        [{ id: 'version' }, { id: 'defaultTier' }, { id: 'l1.maxItems' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['version', 'defaultTier']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'version' }, { id: 'defaultTier' }];
    expect(selectMemoryConfigEntries(entries, undefined)).toEqual(entries);
  });
});
