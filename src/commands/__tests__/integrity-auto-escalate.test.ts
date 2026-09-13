import { describe, expect, it } from 'vitest';
import { parseIntegrityAutoEscalate } from '../integrity.js';

describe('savestate integrity config containment.auto_escalate', () => {
  it('accepts true and false', () => {
    expect(parseIntegrityAutoEscalate('true')).toBe(true);
    expect(parseIntegrityAutoEscalate('false')).toBe(false);
    expect(parseIntegrityAutoEscalate('TRUE')).toBe(true);
    expect(parseIntegrityAutoEscalate(' False ')).toBe(false);
  });

  it.each(['', ' ', 'yes', '1', '0', 'on'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityAutoEscalate(value)).toThrow(
      `Invalid containment.auto_escalate value "${value}". Expected true or false.`,
    );
  });
});
