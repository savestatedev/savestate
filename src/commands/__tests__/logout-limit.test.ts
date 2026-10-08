import { describe, expect, it } from 'vitest';
import { parseLogoutLimit, selectLogoutEntries } from '../login.js';

describe('savestate logout --limit', () => {
  it('defaults to undefined', () => {
    expect(parseLogoutLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseLogoutLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseLogoutLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseLogoutLimit('1000')).toBe(1000);
    expect(() => parseLogoutLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectLogoutEntries(
        [{ id: 'status' }, { id: 'apiKey' }, { id: 'account' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['status', 'apiKey']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'apiKey' }];
    expect(selectLogoutEntries(entries, undefined)).toEqual(entries);
  });
});
