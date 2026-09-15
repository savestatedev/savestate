import { describe, expect, it } from 'vitest';
import { parseTrustBy } from '../trust.js';

describe('savestate trust --by', () => {
  it('defaults to undefined', () => {
    expect(parseTrustBy(undefined)).toBeUndefined();
  });

  it('accepts a single actor id', () => {
    expect(parseTrustBy('cli')).toBe('cli');
    expect(parseTrustBy('operator-1')).toBe('operator-1');
    expect(parseTrustBy(' reviewer-1 ')).toBe('reviewer-1');
  });

  it.each(['', ' ', ',', 'cli,admin', 'cli user'])('rejects invalid value %s', (value) => {
    expect(() => parseTrustBy(value)).toThrow(
      `Invalid --by value "${value}". Expected a single non-empty actor id.`,
    );
  });
});
