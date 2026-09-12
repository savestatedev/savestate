import { describe, expect, it } from 'vitest';
import { parseAclExpiresIn } from '../acl.js';

describe('savestate acl propose --expires-in', () => {
  it('leaves the commitment without an expiry when omitted', () => {
    expect(parseAclExpiresIn(undefined)).toBeUndefined();
  });

  it('accepts positive integers as minutes', () => {
    expect(parseAclExpiresIn('12')).toBe(12);
    expect(parseAclExpiresIn('60')).toBe(60);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseAclExpiresIn(value)).toThrow(
      `Invalid --expires-in value "${value}". Expected a positive integer up to 10080.`,
    );
  });

  it('rejects values above the bounded expiry', () => {
    expect(parseAclExpiresIn('10080')).toBe(10080);
    expect(() => parseAclExpiresIn('10081')).toThrow(
      'Invalid --expires-in value "10081". Expected a positive integer up to 10080.',
    );
  });
});
