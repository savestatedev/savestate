import { describe, expect, it } from 'vitest';
import { parseIntegrityHoneyfactCount } from '../integrity.js';

describe('savestate integrity config honeyfact.count', () => {
  it('accepts positive integers', () => {
    expect(parseIntegrityHoneyfactCount('10')).toBe(10);
    expect(parseIntegrityHoneyfactCount('1000')).toBe(1000);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityHoneyfactCount(value)).toThrow(
      `Invalid honeyfact.count value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded honeyfact count', () => {
    expect(() => parseIntegrityHoneyfactCount('1001')).toThrow(
      'Invalid honeyfact.count value "1001". Expected a positive integer up to 1000.',
    );
  });
});
