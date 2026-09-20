import { describe, expect, it } from 'vitest';
import { parseIntegrityPolicy } from '../integrity.js';

describe('savestate integrity --policy', () => {
  it('defaults to undefined', () => {
    expect(parseIntegrityPolicy(undefined)).toBeUndefined();
  });

  it('accepts known containment policies', () => {
    expect(parseIntegrityPolicy('observe')).toBe('observe');
    expect(parseIntegrityPolicy('approve')).toBe('approve');
    expect(parseIntegrityPolicy('AUTO')).toBe('auto');
    expect(parseIntegrityPolicy(' Approve ')).toBe('approve');
  });

  it.each(['', ' ', 'deny', 'closed', 'observe,auto'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseIntegrityPolicy(value)).toThrow(
        `Invalid --policy value "${value}". Expected one of: observe, approve, auto.`,
      );
    },
  );
});
