import { describe, expect, it } from 'vitest';
import { parseIdentitySetLimit, selectIdentitySetEntries } from '../identity.js';

describe('savestate identity set --limit', () => {
  it('defaults to undefined', () => {
    expect(parseIdentitySetLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseIdentitySetLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIdentitySetLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseIdentitySetLimit('1000')).toBe(1000);
    expect(() => parseIdentitySetLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N field rows', () => {
    expect(
      selectIdentitySetEntries(
        [{ id: 'field' }, { id: 'value' }, { id: 'version' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['field', 'value']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'field' }, { id: 'value' }];
    expect(selectIdentitySetEntries(entries, undefined)).toEqual(entries);
  });
});
