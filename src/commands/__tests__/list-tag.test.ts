import { describe, expect, it } from 'vitest';
import { parseListTag } from '../list.js';

describe('savestate list --tag', () => {
  it('defaults to undefined', () => {
    expect(parseListTag(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot tag', () => {
    expect(parseListTag('work')).toBe('work');
    expect(parseListTag('weekly')).toBe('weekly');
    expect(parseListTag(' v2 ')).toBe('v2');
  });

  it.each(['', ' ', ',', 'work,personal'])('rejects invalid value %s', (value) => {
    expect(() => parseListTag(value)).toThrow(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  });
});
