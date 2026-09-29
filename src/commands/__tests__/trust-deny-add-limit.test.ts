import { describe, expect, it } from 'vitest';
import { parseTrustDenyAddLimit, selectTrustDenyAddEntries } from '../trust.js';

describe('savestate trust deny add --limit', () => {
  it('defaults to undefined', () => {
    expect(parseTrustDenyAddLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseTrustDenyAddLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTrustDenyAddLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseTrustDenyAddLimit('1000')).toBe(1000);
    expect(() => parseTrustDenyAddLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectTrustDenyAddEntries(
        [{ id: 'added' }, { id: 'reason' }, { id: 'by' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['added', 'reason']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'added' }, { id: 'reason' }];
    expect(selectTrustDenyAddEntries(entries, undefined)).toEqual(entries);
  });
});
