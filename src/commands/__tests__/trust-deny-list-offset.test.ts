import { describe, expect, it } from 'vitest';
import {
  applyTrustDenyListFilters,
  parseTrustDenyListOffset,
  selectTrustDenyListOffsetEntries,
} from '../trust.js';

describe('savestate trust deny list --offset', () => {
  it('defaults to undefined', () => {
    expect(parseTrustDenyListOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseTrustDenyListOffset('0')).toBe(0);
    expect(parseTrustDenyListOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTrustDenyListOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseTrustDenyListOffset('1000')).toBe(1000);
    expect(() => parseTrustDenyListOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N denylist entries', () => {
    expect(
      selectTrustDenyListOffsetEntries(
        [{ pattern: 'secret.env' }, { pattern: 'token' }, { pattern: 'key' }],
        1,
      ).map((entry) => entry.pattern),
    ).toEqual(['token', 'key']);
  });

  it('returns all entries when offset is omitted', () => {
    const entries = [{ pattern: 'secret.env' }, { pattern: 'token' }];
    expect(selectTrustDenyListOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips denylist entries before --limit', () => {
    expect(
      applyTrustDenyListFilters(
        [{ pattern: 'secret.env' }, { pattern: 'token' }, { pattern: 'key' }],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.pattern),
    ).toEqual(['token']);
  });
});
