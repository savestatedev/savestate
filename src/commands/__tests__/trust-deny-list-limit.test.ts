import { describe, expect, it } from 'vitest';
import { parseTrustDenyListLimit, selectTrustDenyListEntries } from '../trust.js';

describe('savestate trust deny list --limit', () => {
  it('defaults to undefined', () => {
    expect(parseTrustDenyListLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseTrustDenyListLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
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
});
