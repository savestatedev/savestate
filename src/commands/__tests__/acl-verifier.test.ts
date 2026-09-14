import { describe, expect, it } from 'vitest';
import { parseAclVerifier } from '../acl.js';

describe('savestate acl --verifier', () => {
  it('accepts a single verifier id', () => {
    expect(parseAclVerifier('reviewer-1')).toBe('reviewer-1');
    expect(parseAclVerifier('agent-verifier')).toBe('agent-verifier');
    expect(parseAclVerifier(' reviewer-1 ')).toBe('reviewer-1');
  });

  it.each(['', ' ', ',', 'reviewer-1,reviewer-2', 'reviewer 1'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseAclVerifier(value)).toThrow(
        `Invalid --verifier value "${value}". Expected a single non-empty verifier id.`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseAclVerifier(undefined)).toThrow(
      'Invalid --verifier value. Expected a single non-empty verifier id.',
    );
  });
});
