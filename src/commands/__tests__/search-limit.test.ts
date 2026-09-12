import { describe, expect, it } from 'vitest';
import { parseSearchLimit } from '../search.js';

describe('savestate search --limit', () => {
  it('defaults to 20 results', () => {
    expect(parseSearchLimit(undefined)).toBe(20);
  });

  it('accepts positive integers', () => {
    expect(parseSearchLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseSearchLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSearchLimit('1000')).toBe(1000);
    expect(() => parseSearchLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });
});
