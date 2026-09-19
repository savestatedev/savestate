import { describe, expect, it } from 'vitest';
import { parseIdentityValue } from '../identity.js';

describe('savestate identity set value', () => {
  it('accepts a non-empty identity value', () => {
    expect(parseIdentityValue('professional')).toBe('professional');
    expect(parseIdentityValue('["Help users"]')).toBe('["Help users"]');
    expect(parseIdentityValue(' custom value ')).toBe('custom value');
  });

  it.each(['', ' '])('rejects invalid value %s', (value) => {
    expect(() => parseIdentityValue(value)).toThrow(
      `Invalid value "${value}". Expected a non-empty identity value.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseIdentityValue(undefined)).toThrow(
      'Invalid value. Expected a non-empty identity value.',
    );
  });
});
