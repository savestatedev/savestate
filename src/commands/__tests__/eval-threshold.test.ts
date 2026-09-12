import { describe, expect, it } from 'vitest';
import { parseEvalThreshold } from '../eval.js';

describe('savestate eval --threshold', () => {
  it('accepts scores in 0..1', () => {
    expect(parseEvalThreshold(undefined)).toBe(0.7);
    expect(parseEvalThreshold('0')).toBe(0);
    expect(parseEvalThreshold('0.9')).toBe(0.9);
    expect(parseEvalThreshold('1')).toBe(1);
  });

  it.each(['-0.1', '1.1', 'nope', ''])('rejects invalid value %s', (value) => {
    expect(() => parseEvalThreshold(value)).toThrow(
      `Invalid --threshold value "${value}". Expected a number between 0 and 1.`,
    );
  });
});
