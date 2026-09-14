import { describe, expect, it } from 'vitest';
import { parseIntegrityUser } from '../integrity.js';

describe('savestate integrity --user', () => {
  it('defaults to undefined', () => {
    expect(parseIntegrityUser(undefined)).toBeUndefined();
  });

  it('accepts a single user id', () => {
    expect(parseIntegrityUser('reviewer-1')).toBe('reviewer-1');
    expect(parseIntegrityUser('cli')).toBe('cli');
    expect(parseIntegrityUser('user.abc_def')).toBe('user.abc_def');
    expect(parseIntegrityUser(' reviewer-1 ')).toBe('reviewer-1');
  });

  it.each(['', ' ', ',', 'alice,bob', 'reviewer 1'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityUser(value)).toThrow(
      `Invalid --user value "${value}". Expected a single non-empty user id.`,
    );
  });
});
