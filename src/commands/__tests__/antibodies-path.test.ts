import { describe, expect, it } from 'vitest';
import { parseAntibodiesPath } from '../antibodies.js';

describe('savestate antibodies --path', () => {
  it('defaults to undefined', () => {
    expect(parseAntibodiesPath(undefined)).toBeUndefined();
  });

  it('accepts a single path', () => {
    expect(parseAntibodiesPath('./secret.env')).toBe('./secret.env');
    expect(parseAntibodiesPath('/tmp/secret.env')).toBe('/tmp/secret.env');
    expect(parseAntibodiesPath(' secret.env ')).toBe('secret.env');
  });

  it.each(['', ' ', ',', './a,./b', './secret.env ./other.env'])('rejects invalid value %s', (value) => {
    expect(() => parseAntibodiesPath(value)).toThrow(
      `Invalid --path value "${value}". Expected a single non-empty path.`,
    );
  });
});
