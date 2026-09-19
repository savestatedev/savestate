import { describe, expect, it } from 'vitest';
import { parseVerifyPassphrase } from '../verify.js';

describe('savestate verify --passphrase', () => {
  it('defaults to undefined', () => {
    expect(parseVerifyPassphrase(undefined)).toBeUndefined();
  });

  it('accepts a non-empty passphrase', () => {
    expect(parseVerifyPassphrase('secret')).toBe('secret');
    expect(parseVerifyPassphrase('pass phrase')).toBe('pass phrase');
    expect(parseVerifyPassphrase(' secret ')).toBe(' secret ');
  });

  it.each(['', ' ', '   '])('rejects invalid value %s', (value) => {
    expect(() => parseVerifyPassphrase(value)).toThrow(
      `Invalid --passphrase value "${value}". Expected a non-empty passphrase.`,
    );
  });
});
