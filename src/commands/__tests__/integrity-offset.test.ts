import { describe, expect, it } from 'vitest';
import { parseIntegrityOffset } from '../integrity.js';

describe('savestate integrity incidents --offset', () => {
  it('defaults to undefined and accepts bounded decimal integers', () => {
    expect(parseIntegrityOffset(undefined)).toBeUndefined();
    expect(parseIntegrityOffset(' 12 ')).toBe(12);
    expect(parseIntegrityOffset('1000')).toBe(1000);
  });

  it.each(['', '1.5', '1e2', '0x10', '-1', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(() => parseIntegrityOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });
});
