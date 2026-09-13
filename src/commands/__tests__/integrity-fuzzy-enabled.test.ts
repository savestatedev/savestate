import { describe, expect, it } from 'vitest';
import { parseIntegrityFuzzyEnabled } from '../integrity.js';

describe('savestate integrity config tripwire.fuzzy_enabled', () => {
  it('accepts true and false', () => {
    expect(parseIntegrityFuzzyEnabled('true')).toBe(true);
    expect(parseIntegrityFuzzyEnabled('false')).toBe(false);
    expect(parseIntegrityFuzzyEnabled('TRUE')).toBe(true);
    expect(parseIntegrityFuzzyEnabled(' False ')).toBe(false);
  });

  it.each(['', ' ', 'yes', '1', '0', 'on'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityFuzzyEnabled(value)).toThrow(
      `Invalid tripwire.fuzzy_enabled value "${value}". Expected true or false.`,
    );
  });
});
