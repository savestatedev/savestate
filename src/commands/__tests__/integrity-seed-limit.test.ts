import { describe, expect, it } from 'vitest';
import { parseIntegritySeedLimit, selectIntegritySeedEntries } from '../integrity.js';

describe('savestate integrity seed --limit', () => {
  it('defaults to undefined', () => {
    expect(parseIntegritySeedLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseIntegritySeedLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegritySeedLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseIntegritySeedLimit('1000')).toBe(1000);
    expect(() => parseIntegritySeedLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N category rows', () => {
    expect(
      selectIntegritySeedEntries(
        [{ id: 'cat-1' }, { id: 'cat-2' }, { id: 'cat-3' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['cat-1', 'cat-2']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'cat-1' }, { id: 'cat-2' }];
    expect(selectIntegritySeedEntries(entries, undefined)).toEqual(entries);
  });
});
