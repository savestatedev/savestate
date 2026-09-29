import { describe, expect, it } from 'vitest';
import { parseTrustDenyRemoveLimit, selectTrustDenyRemoveEntries } from '../trust.js';

describe('savestate trust deny remove --limit', () => {
  it('defaults to undefined', () => {
    expect(parseTrustDenyRemoveLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseTrustDenyRemoveLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTrustDenyRemoveLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseTrustDenyRemoveLimit('1000')).toBe(1000);
    expect(() => parseTrustDenyRemoveLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectTrustDenyRemoveEntries(
        [{ id: 'status' }, { id: 'pattern' }, { id: 'removed' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['status', 'pattern']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'pattern' }];
    expect(selectTrustDenyRemoveEntries(entries, undefined)).toEqual(entries);
  });
});
