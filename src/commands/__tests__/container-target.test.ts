import { describe, expect, it } from 'vitest';
import { parseContainerTarget } from '../container.js';

describe('savestate import --target', () => {
  it('defaults to undefined', () => {
    expect(parseContainerTarget(undefined)).toBeUndefined();
  });

  it('accepts a single path', () => {
    expect(parseContainerTarget('./restored')).toBe('./restored');
    expect(parseContainerTarget('restored')).toBe('restored');
    expect(parseContainerTarget(' ./restored ')).toBe('./restored');
  });

  it.each(['', ' ', ',', 'a,b', 'restored other'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseContainerTarget(value)).toThrow(
        `Invalid --target value "${value}". Expected a single non-empty path.`,
      );
    },
  );
});
