import { describe, expect, it } from 'vitest';
import { parseKeepLast } from '../prune.js';

describe('savestate prune --keep-last', () => {
  it('leaves retention uncapped when omitted', () => {
    expect(parseKeepLast(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseKeepLast('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseKeepLast(value)).toThrow(
      `Invalid --keep-last value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded keep count', () => {
    expect(parseKeepLast('1000')).toBe(1000);
    expect(() => parseKeepLast('1001')).toThrow(
      'Invalid --keep-last value "1001". Expected a positive integer up to 1000.',
    );
  });
});
