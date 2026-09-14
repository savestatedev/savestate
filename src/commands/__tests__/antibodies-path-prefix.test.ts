import { describe, expect, it } from 'vitest';
import { parseAntibodiesPathPrefix } from '../antibodies.js';

describe('savestate antibodies --path-prefix', () => {
  it('defaults to undefined', () => {
    expect(parseAntibodiesPathPrefix(undefined)).toBeUndefined();
  });

  it('accepts a single path prefix', () => {
    expect(parseAntibodiesPathPrefix('/tmp')).toBe('/tmp');
    expect(parseAntibodiesPathPrefix('var/log')).toBe('/var/log');
    expect(parseAntibodiesPathPrefix(' /etc ')).toBe('/etc');
  });

  it.each(['', ' ', ',', '/tmp,/var', '/tmp /var'])('rejects invalid value %s', (value) => {
    expect(() => parseAntibodiesPathPrefix(value)).toThrow(
      `Invalid --path-prefix value "${value}". Expected a single non-empty path prefix.`,
    );
  });
});
