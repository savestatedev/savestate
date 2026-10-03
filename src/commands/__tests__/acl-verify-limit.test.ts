import { describe, expect, it } from 'vitest';
import { parseAclVerifyLimit, selectAclVerifyEntries } from '../acl.js';

describe('savestate acl verify --limit', () => {
  it('defaults to undefined', () => {
    expect(parseAclVerifyLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseAclVerifyLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseAclVerifyLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseAclVerifyLimit('1000')).toBe(1000);
    expect(() => parseAclVerifyLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectAclVerifyEntries(
        [{ id: 'state' }, { id: 'verifier' }, { id: 'extra' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['state', 'verifier']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'state' }, { id: 'verifier' }];
    expect(selectAclVerifyEntries(entries, undefined)).toEqual(entries);
  });
});
