import { describe, expect, it } from 'vitest';
import { parseMemoryLimit } from '../memory-cli.js';

describe('memory command --limit', () => {
  it('uses the command fallback when omitted', () => {
    expect(parseMemoryLimit(undefined, 20)).toBe(20);
  });

  it('accepts positive integers', () => {
    expect(parseMemoryLimit('12', 20)).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope', '1001'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryLimit(value, 20)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('accepts the maximum bounded result count', () => {
    expect(parseMemoryLimit('1000', 20)).toBe(1000);
  });
});
