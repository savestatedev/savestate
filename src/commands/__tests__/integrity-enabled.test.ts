import { describe, expect, it } from 'vitest';
import { parseIntegrityEnabled } from '../integrity.js';

describe('savestate integrity config enabled', () => {
  it('accepts true and false', () => {
    expect(parseIntegrityEnabled('true')).toBe(true);
    expect(parseIntegrityEnabled('false')).toBe(false);
    expect(parseIntegrityEnabled('TRUE')).toBe(true);
    expect(parseIntegrityEnabled(' False ')).toBe(false);
  });

  it.each(['', ' ', 'yes', '1', '0', 'on'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityEnabled(value)).toThrow(
      `Invalid enabled value "${value}". Expected true or false.`,
    );
  });
});
