import { describe, expect, it } from 'vitest';
import { parseMemoryImportance } from '../memory-cli.js';

describe('savestate memory edit --importance', () => {
  it('accepts scores in 0..1', () => {
    expect(parseMemoryImportance(undefined)).toBeUndefined();
    expect(parseMemoryImportance('0')).toBe(0);
    expect(parseMemoryImportance('0.9')).toBe(0.9);
    expect(parseMemoryImportance('1')).toBe(1);
  });

  it.each(['-0.1', '1.1', 'nope', ''])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryImportance(value)).toThrow(
      `Invalid --importance value "${value}". Expected a number between 0 and 1.`,
    );
  });
});
