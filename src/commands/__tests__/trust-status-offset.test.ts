import { describe, expect, it } from 'vitest';
import {
  applyTrustStatusFilters,
  parseTrustStatusOffset,
  selectTrustStatusOffsetEntries,
} from '../trust.js';

describe('savestate trust status --offset', () => {
  it('defaults to undefined', () => {
    expect(parseTrustStatusOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseTrustStatusOffset('0')).toBe(0);
    expect(parseTrustStatusOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTrustStatusOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseTrustStatusOffset('1000')).toBe(1000);
    expect(() => parseTrustStatusOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N state or scope metric rows', () => {
    expect(
      selectTrustStatusOffsetEntries(
        [{ id: 'candidate' }, { id: 'stable' }, { id: 'rejected' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['stable', 'rejected']);
  });

  it('returns all rows when offset is omitted', () => {
    const entries = [{ id: 'candidate' }, { id: 'stable' }];
    expect(selectTrustStatusOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips metric rows before --limit', () => {
    expect(
      applyTrustStatusFilters(
        [{ id: 'candidate' }, { id: 'stable' }, { id: 'rejected' }],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['stable']);
  });
});
