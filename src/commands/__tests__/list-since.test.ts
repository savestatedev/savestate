import { describe, expect, it } from 'vitest';
import { parseListSince } from '../list.js';

describe('savestate list --since', () => {
  it('leaves the cutoff unset when omitted', () => {
    expect(parseListSince(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseListSince('2026-01-01')).toBe(new Date('2026-01-01').getTime());
    expect(parseListSince('2026-01-01T00:00:00Z')).toBe(
      new Date('2026-01-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseListSince(value)).toThrow(
        `Invalid --since value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );
});
