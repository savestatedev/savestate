import { describe, expect, it } from 'vitest';
import { parseAclProposeLimit, selectAclProposeEntries } from '../acl.js';

describe('savestate acl propose --limit', () => {
  it('defaults to undefined', () => {
    expect(parseAclProposeLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseAclProposeLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseAclProposeLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseAclProposeLimit('1000')).toBe(1000);
    expect(() => parseAclProposeLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectAclProposeEntries(
        [{ id: 'id' }, { id: 'state' }, { id: 'criticality' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['id', 'state']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'id' }, { id: 'state' }];
    expect(selectAclProposeEntries(entries, undefined)).toEqual(entries);
  });
});
