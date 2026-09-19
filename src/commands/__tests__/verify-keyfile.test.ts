import { describe, expect, it } from 'vitest';
import { parseVerifyKeyfile } from '../verify.js';

describe('savestate verify --keyfile', () => {
  it('defaults to undefined', () => {
    expect(parseVerifyKeyfile(undefined)).toBeUndefined();
  });

  it('accepts a single path', () => {
    expect(parseVerifyKeyfile('./key.bin')).toBe('./key.bin');
    expect(parseVerifyKeyfile('key.bin')).toBe('key.bin');
    expect(parseVerifyKeyfile(' key.bin ')).toBe('key.bin');
  });

  it.each(['', ' ', ',', 'a.key,b.key', 'key bin'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseVerifyKeyfile(value)).toThrow(
        `Invalid --keyfile value "${value}". Expected a single non-empty path.`,
      );
    },
  );
});
