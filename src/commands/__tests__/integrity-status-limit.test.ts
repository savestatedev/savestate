import { describe, expect, it } from 'vitest';
import { parseIntegrityStatusLimit, selectIntegrityStatusEntries } from '../integrity.js';

describe('savestate integrity status --limit', () => {
  it('defaults to undefined', () => {
    expect(parseIntegrityStatusLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseIntegrityStatusLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityStatusLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseIntegrityStatusLimit('1000')).toBe(1000);
    expect(() => parseIntegrityStatusLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N honeyfact, incident, or containment metric rows', () => {
    expect(
      selectIntegrityStatusEntries(
        [{ id: 'active' }, { id: 'expired' }, { id: 'total' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['active', 'expired']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'open' }, { id: 'contained' }];
    expect(selectIntegrityStatusEntries(entries, undefined)).toEqual(entries);
  });
});
