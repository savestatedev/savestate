import { describe, expect, it } from 'vitest';
import { parseAclDescription } from '../acl.js';

describe('savestate acl --description', () => {
  it('accepts a non-empty description', () => {
    expect(parseAclDescription('Refund within 24h')).toBe('Refund within 24h');
    expect(parseAclDescription('Follow up with customer, then close')).toBe(
      'Follow up with customer, then close',
    );
    expect(parseAclDescription(' Refund within 24h ')).toBe('Refund within 24h');
  });

  it.each(['', ' '])('rejects invalid value %s', (value) => {
    expect(() => parseAclDescription(value)).toThrow(
      `Invalid --description value "${value}". Expected a non-empty commitment description.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseAclDescription(undefined)).toThrow(
      'Invalid --description value. Expected a non-empty commitment description.',
    );
  });
});
