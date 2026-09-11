import { describe, expect, it } from 'vitest';
import { parseListLimit } from '../list.js';

describe('savestate list --limit', () => {
  it('defaults to 50 snapshots', () => {
    expect(parseListLimit(undefined)).toBe(50);
  });

  it('accepts positive integers', () => {
    expect(parseListLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseListLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer.`,
    );
  });
});
