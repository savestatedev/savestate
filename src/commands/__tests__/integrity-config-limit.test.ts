import { describe, expect, it } from 'vitest';
import { parseIntegrityConfigLimit, selectIntegrityConfigEntries } from '../integrity.js';

describe('savestate integrity config --limit', () => {
  it('defaults to undefined', () => {
    expect(parseIntegrityConfigLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseIntegrityConfigLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityConfigLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseIntegrityConfigLimit('1000')).toBe(1000);
    expect(() => parseIntegrityConfigLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N configuration setting rows', () => {
    expect(
      selectIntegrityConfigEntries(
        [{ id: 'enabled' }, { id: 'honeyfact.count' }, { id: 'honeyfact.ttl_days' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['enabled', 'honeyfact.count']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'enabled' }, { id: 'honeyfact.count' }];
    expect(selectIntegrityConfigEntries(entries, undefined)).toEqual(entries);
  });
});
