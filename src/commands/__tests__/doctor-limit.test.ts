import { describe, expect, it } from 'vitest';
import { parseDoctorLimit } from '../doctor.js';

describe('savestate doctor --limit', () => {
  it('defaults to undefined', () => {
    expect(parseDoctorLimit(undefined)).toBeUndefined();
  });

  it('accepts positive decimal integers with surrounding whitespace', () => {
    expect(parseDoctorLimit(' 12 ')).toBe(12);
    expect(parseDoctorLimit('1000')).toBe(1000);
  });

  it.each(['0', '-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseDoctorLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(() => parseDoctorLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });
});
