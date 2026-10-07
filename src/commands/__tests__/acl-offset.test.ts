import { describe, expect, it } from 'vitest';
import {
  applyAclOffset,
  formatAclListEmpty,
  formatAclListHeading,
  parseAclOffset,
} from '../acl.js';

describe('savestate acl list --offset', () => {
  it('defaults to undefined', () => {
    expect(parseAclOffset(undefined)).toBeUndefined();
  });

  it('accepts non-negative integers', () => {
    expect(parseAclOffset('0')).toBe(0);
    expect(parseAclOffset('12')).toBe(12);
    expect(parseAclOffset('1000')).toBe(1000);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseAclOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(() => parseAclOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips commitments before the limit is applied', () => {
    expect(
      applyAclOffset(
        [{ id: 'cmt-refund' }, { id: 'cmt-escalate' }, { id: 'cmt-write' }],
        1,
      ).map((commitment) => commitment.id),
    ).toEqual(['cmt-escalate', 'cmt-write']);
  });

  it('returns all commitments when --offset is omitted', () => {
    const commitments = [{ id: 'cmt-refund' }, { id: 'cmt-escalate' }];
    expect(applyAclOffset(commitments, undefined)).toEqual(commitments);
  });

  it('explains the applied page window in human-readable output', () => {
    expect(formatAclListHeading(2, 10, 5)).toBe('Found 2 commitment(s) (skipped 10, limit 5):');
    expect(formatAclListHeading(2, undefined, undefined)).toBe('Found 2 commitment(s):');
  });

  it('explains an empty page window in human-readable output', () => {
    expect(formatAclListEmpty(10, 5)).toBe('No commitments found (skipped 10, limit 5).');
    expect(formatAclListEmpty(undefined, undefined)).toBe('No commitments found.');
  });
});
