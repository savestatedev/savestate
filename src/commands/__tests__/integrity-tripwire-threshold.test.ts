import { describe, expect, it } from 'vitest';
import { parseIntegrityTripwireThreshold } from '../integrity.js';

describe('savestate integrity config tripwire.threshold', () => {
  it('accepts numbers between 0 and 1', () => {
    expect(parseIntegrityTripwireThreshold('0')).toBe(0);
    expect(parseIntegrityTripwireThreshold('0.8')).toBe(0.8);
    expect(parseIntegrityTripwireThreshold('1')).toBe(1);
  });

  it.each(['', ' ', '-0.1', '1.1', 'nope', 'NaN', 'Infinity'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseIntegrityTripwireThreshold(value)).toThrow(
        `Invalid tripwire.threshold value "${value}". Expected a number between 0 and 1.`,
      );
    },
  );
});
