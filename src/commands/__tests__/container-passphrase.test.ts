import { describe, expect, it } from 'vitest';
import { parseContainerPassphrase } from '../container.js';

describe('savestate container --passphrase', () => {
  it('defaults to undefined', () => {
    expect(parseContainerPassphrase(undefined)).toBeUndefined();
  });

  it('accepts a non-empty passphrase', () => {
    expect(parseContainerPassphrase('secret')).toBe('secret');
    expect(parseContainerPassphrase('pass phrase')).toBe('pass phrase');
    expect(parseContainerPassphrase(' secret ')).toBe(' secret ');
  });

  it.each(['', ' ', '   '])('rejects invalid value %s', (value) => {
    expect(() => parseContainerPassphrase(value)).toThrow(
      `Invalid --passphrase value "${value}". Expected a non-empty passphrase.`,
    );
  });
});
