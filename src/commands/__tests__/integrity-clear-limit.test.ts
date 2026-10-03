import { describe, expect, it } from 'vitest';
import { parseIntegrityClearLimit, selectIntegrityClearEntries } from '../integrity.js';

describe('savestate integrity clear --limit', () => {
  it('defaults to undefined', () => {
    expect(parseIntegrityClearLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseIntegrityClearLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityClearLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseIntegrityClearLimit('1000')).toBe(1000);
    expect(() => parseIntegrityClearLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectIntegrityClearEntries(
        [{ id: 'row-1' }, { id: 'row-2' }, { id: 'row-3' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['row-1', 'row-2']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'row-1' }, { id: 'row-2' }];
    expect(selectIntegrityClearEntries(entries, undefined)).toEqual(entries);
  });
});
