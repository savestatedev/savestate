import { describe, expect, it } from 'vitest';
import { parseAclCriticality } from '../acl.js';

describe('savestate acl propose --criticality', () => {
  it('accepts known criticality levels', () => {
    expect(parseAclCriticality('c1')).toBe('c1');
    expect(parseAclCriticality('c2')).toBe('c2');
    expect(parseAclCriticality('C3')).toBe('c3');
    expect(parseAclCriticality(' c1 ')).toBe('c1');
  });

  it.each(['', ' ', 'nope', 'c4', '1', 'critical'])('rejects invalid value %s', (value) => {
    expect(() => parseAclCriticality(value)).toThrow(
      `Invalid --criticality value "${value}". Expected one of: c1, c2, c3.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseAclCriticality(undefined)).toThrow(
      'Invalid --criticality value. Expected one of: c1, c2, c3.',
    );
  });
});
