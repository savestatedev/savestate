import { describe, expect, it } from 'vitest';
import { parseIntegrityContainmentPolicy } from '../integrity.js';

describe('savestate integrity config containment.policy', () => {
  it('accepts known policies', () => {
    expect(parseIntegrityContainmentPolicy('observe')).toBe('observe');
    expect(parseIntegrityContainmentPolicy('approve')).toBe('approve');
    expect(parseIntegrityContainmentPolicy('auto')).toBe('auto');
  });

  it.each(['', ' ', 'deny', 'APPROVE', 'observe,auto'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseIntegrityContainmentPolicy(value)).toThrow(
        `Invalid containment.policy value "${value}". Expected one of: observe, approve, auto.`,
      );
    },
  );
});
