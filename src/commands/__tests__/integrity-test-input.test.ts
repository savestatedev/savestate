import { describe, expect, it } from 'vitest';
import { parseIntegrityTestInput } from '../integrity.js';

describe('savestate integrity test input', () => {
  it('accepts non-empty text to check', () => {
    expect(parseIntegrityTestInput('canary text')).toBe('canary text');
    expect(parseIntegrityTestInput('poisoned memory, maybe')).toBe('poisoned memory, maybe');
    expect(parseIntegrityTestInput(' canary text ')).toBe('canary text');
  });

  it.each(['', ' '])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityTestInput(value)).toThrow(
      `Invalid test input "${value}". Expected a non-empty text to check.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseIntegrityTestInput(undefined)).toThrow(
      'Invalid test input. Expected a non-empty text to check.',
    );
  });
});
