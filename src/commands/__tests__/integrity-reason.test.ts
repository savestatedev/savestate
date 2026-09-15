import { describe, expect, it } from 'vitest';
import { parseIntegrityReason } from '../integrity.js';

describe('savestate integrity --reason', () => {
  it('defaults to undefined', () => {
    expect(parseIntegrityReason(undefined)).toBeUndefined();
  });

  it('accepts a non-empty reason', () => {
    expect(parseIntegrityReason('tripwire hit')).toBe('tripwire hit');
    expect(parseIntegrityReason('manual review')).toBe('manual review');
    expect(parseIntegrityReason(' tripwire hit ')).toBe('tripwire hit');
  });

  it.each(['', ' '])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityReason(value)).toThrow(
      `Invalid --reason value "${value}". Expected a non-empty reason.`,
    );
  });
});
