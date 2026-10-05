import { describe, expect, it } from 'vitest';
import {
  applyTrustAuditFilters,
  parseTrustAuditOffset,
  selectTrustAuditOffsetEntries,
} from '../trust.js';

describe('savestate trust audit --offset', () => {
  it('defaults to undefined', () => {
    expect(parseTrustAuditOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseTrustAuditOffset('0')).toBe(0);
    expect(parseTrustAuditOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTrustAuditOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseTrustAuditOffset('1000')).toBe(1000);
    expect(() => parseTrustAuditOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N audit events', () => {
    expect(
      selectTrustAuditOffsetEntries(
        [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['e2', 'e3']);
  });

  it('returns all events when offset is omitted', () => {
    const entries = [{ id: 'e1' }, { id: 'e2' }];
    expect(selectTrustAuditOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips audit events before --limit', () => {
    expect(
      applyTrustAuditFilters(
        [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['e2']);
  });
});
