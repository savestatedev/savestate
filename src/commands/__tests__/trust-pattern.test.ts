import { describe, expect, it } from 'vitest';
import { parseTrustPattern } from '../trust.js';

describe('savestate trust deny pattern', () => {
  it('accepts a single denylist pattern', () => {
    expect(parseTrustPattern('secret.env')).toBe('secret.env');
    expect(parseTrustPattern('credentials')).toBe('credentials');
    expect(parseTrustPattern(' api-key ')).toBe('api-key');
  });

  it.each(['', ' ', ',', 'secret.env,token', 'secret env'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseTrustPattern(value)).toThrow(
        `Invalid pattern "${value}". Expected a single non-empty denylist pattern.`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseTrustPattern(undefined)).toThrow(
      'Invalid pattern. Expected a single non-empty denylist pattern.',
    );
  });
});
