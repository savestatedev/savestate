import { describe, expect, it } from 'vitest';
import { parseSearchOffset, selectSearchOffsetEntries } from '../search.js';

describe('savestate search --offset', () => {
  it('defaults to undefined', () => {
    expect(parseSearchOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseSearchOffset('0')).toBe(0);
    expect(parseSearchOffset('12')).toBe(12);
  });

  it('accepts surrounding whitespace', () => {
    expect(parseSearchOffset(' 12 ')).toBe(12);
    expect(parseSearchOffset(' 1')).toBe(1);
  });

  it.each(['-1', '1.5', 'nope', ''])('rejects invalid value %s', (value) => {
    expect(() => parseSearchOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseSearchOffset('1000')).toBe(1000);
    expect(() => parseSearchOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N ranked results', () => {
    expect(
      selectSearchOffsetEntries(
        [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }],
        1,
      ).map((result) => result.id),
    ).toEqual(['r2', 'r3']);
  });

  it('returns all results when offset is omitted', () => {
    const entries = [{ id: 'r1' }, { id: 'r2' }];
    expect(selectSearchOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips the first ranked results before --limit', () => {
    expect(
      selectSearchOffsetEntries(
        [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }],
        1,
      ).slice(0, 1).map((result) => result.id),
    ).toEqual(['r2']);
  });
});
