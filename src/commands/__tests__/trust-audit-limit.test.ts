import { describe, expect, it } from 'vitest';
import { parseTrustAuditLimit } from '../trust.js';

describe('savestate trust audit --limit', () => {
  it('defaults to 50 events', () => {
    expect(parseTrustAuditLimit(undefined)).toBe(50);
  });

  it('accepts positive integers', () => {
    expect(parseTrustAuditLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
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
