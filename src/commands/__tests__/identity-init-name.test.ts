import { describe, expect, it } from 'vitest';
import { parseIdentityName } from '../identity.js';

describe('savestate identity init name', () => {
  it('accepts a single identity name', () => {
    expect(parseIdentityName('MyAgent')).toBe('MyAgent');
    expect(parseIdentityName('ops-bot')).toBe('ops-bot');
    expect(parseIdentityName(' MyAgent ')).toBe('MyAgent');
  });

  it.each(['', ' ', ',', 'MyAgent,Other', 'My Agent'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseIdentityName(value)).toThrow(
        `Invalid name "${value}". Expected a single non-empty identity name.`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseIdentityName(undefined)).toThrow(
      'Invalid name. Expected a single non-empty identity name.',
    );
  });
});
