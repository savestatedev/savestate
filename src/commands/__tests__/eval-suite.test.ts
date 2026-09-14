import { describe, expect, it } from 'vitest';
import { parseEvalSuite } from '../eval.js';

describe('savestate eval --suite', () => {
  it('defaults to undefined', () => {
    expect(parseEvalSuite(undefined)).toBeUndefined();
  });

  it('accepts a single suite name', () => {
    expect(parseEvalSuite('recall')).toBe('recall');
    expect(parseEvalSuite(' precision ')).toBe('precision');
  });

  it.each(['', ' ', ',', 'recall,precision', 'recall suite'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseEvalSuite(value)).toThrow(
        `Invalid --suite value "${value}". Expected a single non-empty benchmark suite name.`,
      );
    },
  );
});
