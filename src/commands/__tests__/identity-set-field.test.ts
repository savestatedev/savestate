import { describe, expect, it } from 'vitest';
import { getIdentityFieldValue, parseIdentityField } from '../identity.js';
import type { AgentIdentity } from '../../identity/schema.js';

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

  it.each(['unknown', 'metadata'])('rejects unsupported field %s', (value) => {
    expect(() => parseIdentityField(value)).toThrow(
      `Invalid field "${value}". Expected a core identity field or metadata.<key>.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseIdentityField(undefined)).toThrow(
      'Invalid field. Expected a single non-empty identity field.',
    );
  });

  it('reads dotted metadata fields for confirmation output', () => {
    const identity = {
      metadata: { customKey: 'custom value' },
      name: 'MyAgent',
    } as AgentIdentity;

    expect(getIdentityFieldValue(identity, 'metadata.customKey')).toBe('custom value');
    expect(getIdentityFieldValue(identity, 'name')).toBe('MyAgent');
  });
});
