import { describe, expect, it } from 'vitest';
import { parseAntibodiesErrorCode } from '../antibodies.js';

describe('savestate antibodies --error-code', () => {
  it('defaults to undefined', () => {
    expect(parseAntibodiesErrorCode(undefined)).toBeUndefined();
  });

  it('accepts a single error code', () => {
    expect(parseAntibodiesErrorCode('EACCES')).toBe('EACCES');
    expect(parseAntibodiesErrorCode('enoent')).toBe('ENOENT');
    expect(parseAntibodiesErrorCode(' EPERM ')).toBe('EPERM');
  });

  it.each(['', ' ', ',', 'EACCES,ENOENT', 'EACCES ENOENT'])('rejects invalid value %s', (value) => {
    expect(() => parseAntibodiesErrorCode(value)).toThrow(
      `Invalid --error-code value "${value}". Expected a single non-empty error code.`,
    );
  });
});
