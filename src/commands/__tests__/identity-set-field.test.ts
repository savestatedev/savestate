import { describe, expect, it } from 'vitest';
import { parseIdentityField } from '../identity.js';

describe('savestate identity set field', () => {
  it('accepts a single identity field', () => {
    expect(parseIdentityField('tone')).toBe('tone');
    expect(parseIdentityField('goals')).toBe('goals');
    expect(parseIdentityField('metadata.customKey')).toBe('metadata.customKey');
    expect(parseIdentityField(' tone ')).toBe('tone');
  });

  it.each(['', ' ', ',', 'tone,goals', 'tone professional'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseIdentityField(value)).toThrow(
        `Invalid field "${value}". Expected a single non-empty identity field.`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseIdentityField(undefined)).toThrow(
      'Invalid field. Expected a single non-empty identity field.',
    );
  });
});
