import { describe, expect, it } from 'vitest';
import { parseIntegrityTtlDays } from '../integrity.js';

describe('savestate integrity config honeyfact.ttl_days', () => {
  it('accepts positive integers', () => {
    expect(parseIntegrityTtlDays('7')).toBe(7);
    expect(parseIntegrityTtlDays('365')).toBe(365);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityTtlDays(value)).toThrow(
      `Invalid honeyfact.ttl_days value "${value}". Expected a positive integer up to 365.`,
    );
  });

  it('rejects values above the bounded honeyfact TTL', () => {
    expect(() => parseIntegrityTtlDays('366')).toThrow(
      'Invalid honeyfact.ttl_days value "366". Expected a positive integer up to 365.',
    );
  });
});
