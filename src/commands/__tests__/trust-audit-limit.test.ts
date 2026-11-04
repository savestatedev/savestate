import { describe, expect, it } from 'vitest';
import { parseTrustAuditLimit, parseTrustAuditOffset } from '../trust.js';

describe('savestate trust audit --limit', () => {
  it('defaults to 50 events', () => {
    expect(parseTrustAuditLimit(undefined)).toBe(50);
  });

  it('accepts positive integers', () => {
    expect(parseTrustAuditLimit('12')).toBe(12);
    expect(parseTrustAuditLimit(' 12 ')).toBe(12);
  });

  it.each(['0', '-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTrustAuditLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded event count', () => {
    expect(parseTrustAuditLimit('1000')).toBe(1000);
    expect(() => parseTrustAuditLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });
});

describe('savestate trust audit --offset', () => {
  it('accepts non-negative decimal integers', () => {
    expect(parseTrustAuditOffset('12')).toBe(12);
    expect(parseTrustAuditOffset(' 12 ')).toBe(12);
  });

  it.each(['-1', '1.5', '1e2', '0x10', 'nope', ''])('rejects invalid value %s', (value) => {
    expect(() => parseTrustAuditOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });
});
