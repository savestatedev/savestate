import { describe, expect, it } from 'vitest';
import {
  parseTrustDenyListLimit,
  parseTrustDenyListOffset,
  selectTrustDenyListEntries,
} from '../trust.js';

describe('savestate trust deny list --limit', () => {
  it('defaults to undefined', () => {
    expect(parseTrustDenyListLimit(undefined)).toBeUndefined();
  });

  it('accepts positive decimal integers with surrounding whitespace', () => {
    expect(parseTrustDenyListLimit('12')).toBe(12);
    expect(parseTrustDenyListLimit(' 12 ')).toBe(12);
  });

  it.each(['0', '-1', '1.5', '1e2', '0x10', ' ', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTrustDenyListLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseTrustDenyListLimit('1000')).toBe(1000);
    expect(() => parseTrustDenyListLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N denylist entries', () => {
    expect(
      selectTrustDenyListEntries(
        [{ pattern: 'secret.env' }, { pattern: 'token' }, { pattern: 'key' }],
        2,
      ).map((entry) => entry.pattern),
    ).toEqual(['secret.env', 'token']);
  });

  it('returns all entries when --limit is omitted', () => {
    const entries = [{ pattern: 'secret.env' }, { pattern: 'token' }];
    expect(selectTrustDenyListEntries(entries, undefined)).toEqual(entries);
  });

  it('rejects non-decimal offsets while accepting surrounding whitespace', () => {
    expect(parseTrustDenyListOffset(' 12 ')).toBe(12);
    for (const value of ['1e2', '0x10', ' ']) {
      expect(() => parseTrustDenyListOffset(value)).toThrow(
        `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
      );
    }
  });
});
