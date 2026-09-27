import { describe, expect, it } from 'vitest';
import { applyAclLimit, parseAclLimit } from '../acl.js';

describe('savestate acl --limit', () => {
  it('defaults to undefined', () => {
    expect(parseAclLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseAclLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseAclLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseAclLimit('1000')).toBe(1000);
    expect(() => parseAclLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N commitments', () => {
    expect(
      applyAclLimit(
        [{ id: 'cmt-refund' }, { id: 'cmt-escalate' }, { id: 'cmt-write' }],
        2,
      ).map((commitment) => commitment.id),
    ).toEqual(['cmt-refund', 'cmt-escalate']);
  });

  it('returns all commitments when --limit is omitted', () => {
    const commitments = [{ id: 'cmt-refund' }, { id: 'cmt-escalate' }];
    expect(applyAclLimit(commitments, undefined)).toEqual(commitments);
  });
});
