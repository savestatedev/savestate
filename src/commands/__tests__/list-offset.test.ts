import { describe, expect, it } from 'vitest';
import { formatListPageSummary, parseListOffset, selectListOffsetEntries } from '../list.js';

describe('savestate list --offset', () => {
  it('defaults to undefined', () => {
    expect(parseListOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseListOffset('0')).toBe(0);
    expect(parseListOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseListOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseListOffset('1000')).toBe(1000);
    expect(() => parseListOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N snapshots', () => {
    expect(
      selectListOffsetEntries(
        [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['s2', 's3']);
  });

  it('returns all snapshots when offset is omitted', () => {
    const entries = [{ id: 's1' }, { id: 's2' }];
    expect(selectListOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('reports the filtered total and offset for a human-readable page', () => {
    expect(formatListPageSummary(12, 2, 10, 2)).toBe(
      '(showing 2 of 12 after filters; offset 10, limit 2)',
    );
  });
});
