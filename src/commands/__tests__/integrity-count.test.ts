import { describe, expect, it } from 'vitest';
import { parseIntegrityCount } from '../integrity.js';

describe('savestate integrity --count', () => {
  it('leaves the configured honeyfact count in place when omitted', () => {
    expect(parseIntegrityCount(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseIntegrityCount('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityCount(value)).toThrow(
      `Invalid --count value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded seed count', () => {
    expect(parseIntegrityCount('1000')).toBe(1000);
    expect(() => parseIntegrityCount('1001')).toThrow(
      'Invalid --count value "1001". Expected a positive integer up to 1000.',
    );
  });
});
