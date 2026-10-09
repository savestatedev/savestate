import { describe, expect, it } from 'vitest';
import { parseMemoryListLimit } from '../memory.js';

describe('savestate memory list --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryListLimit(undefined)).toBeUndefined();
  });

  it('accepts positive decimal integers', () => {
    expect(parseMemoryListLimit('12')).toBe(12);
    expect(parseMemoryListLimit('1000')).toBe(1000);
  });

  it('accepts surrounding whitespace', () => {
    expect(parseMemoryListLimit(' 12 ')).toBe(12);
  });

  it.each(['0', '-1', '1.5', '0x10', '1e2', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryListLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });
});
