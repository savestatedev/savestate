import { describe, expect, it } from 'vitest';
import { parseContainerKeyfile } from '../container.js';

describe('savestate container --keyfile', () => {
  it('defaults to undefined', () => {
    expect(parseContainerKeyfile(undefined)).toBeUndefined();
  });

  it('accepts a single path', () => {
    expect(parseContainerKeyfile('./key.bin')).toBe('./key.bin');
    expect(parseContainerKeyfile('key.bin')).toBe('key.bin');
    expect(parseContainerKeyfile(' key.bin ')).toBe('key.bin');
  });

  it.each(['', ' ', ',', 'a.key,b.key', 'key bin'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseContainerKeyfile(value)).toThrow(
        `Invalid --keyfile value "${value}". Expected a single non-empty path.`,
      );
    },
  );
});
