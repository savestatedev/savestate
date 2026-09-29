import { describe, expect, it } from 'vitest';
import { parseIdentityInitLimit, selectIdentityInitEntries } from '../identity.js';

describe('savestate identity init --limit', () => {
  it('defaults to undefined', () => {
    expect(parseIdentityInitLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseIdentityInitLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIdentityInitLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseIdentityInitLimit('1000')).toBe(1000);
    expect(() => parseIdentityInitLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectIdentityInitEntries(
        [{ id: 'name' }, { id: 'version' }, { id: 'file' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['name', 'version']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'name' }, { id: 'version' }];
    expect(selectIdentityInitEntries(entries, undefined)).toEqual(entries);
  });
});
