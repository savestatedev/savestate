import { describe, expect, it } from 'vitest';
import { parseTrustStatusLimit, selectTrustStatusEntries } from '../trust.js';

describe('savestate trust status --limit', () => {
  it('defaults to undefined', () => {
    expect(parseTrustStatusLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseTrustStatusLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTrustStatusLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseTrustStatusLimit('1000')).toBe(1000);
    expect(() => parseTrustStatusLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N state or scope metric rows', () => {
    expect(
      selectTrustStatusEntries(
        [{ id: 'candidate' }, { id: 'stable' }, { id: 'rejected' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['candidate', 'stable']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'candidate' }, { id: 'stable' }];
    expect(selectTrustStatusEntries(entries, undefined)).toEqual(entries);
  });
});
