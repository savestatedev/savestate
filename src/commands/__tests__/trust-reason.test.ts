import { describe, expect, it } from 'vitest';
import { parseTrustReason } from '../trust.js';

describe('savestate trust --reason', () => {
  it('defaults to undefined', () => {
    expect(parseTrustReason(undefined)).toBeUndefined();
  });

  it('accepts a non-empty reason', () => {
    expect(parseTrustReason('contains credentials')).toBe('contains credentials');
    expect(parseTrustReason('secret pattern')).toBe('secret pattern');
    expect(parseTrustReason(' contains credentials ')).toBe('contains credentials');
  });

  it.each(['', ' '])('rejects invalid value %s', (value) => {
    expect(() => parseTrustReason(value)).toThrow(
      `Invalid --reason value "${value}". Expected a non-empty reason.`,
    );
  });
});
