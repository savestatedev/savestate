import { describe, expect, it } from 'vitest';
import { parseListUntil } from '../list.js';

describe('savestate list --until', () => {
  it('leaves the cutoff unset when omitted', () => {
    expect(parseListUntil(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseListUntil('2026-01-01')).toBe(
      new Date('2026-01-01T23:59:59.999Z').getTime(),
    );
    expect(parseListUntil('2026-01-01T00:00:00Z')).toBe(
      new Date('2026-01-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseListUntil(value)).toThrow(
        `Invalid --until value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );

  it('rejects impossible calendar values in timestamps instead of normalizing them', () => {
    expect(() => parseListUntil('2026-02-30T23:59:59Z')).toThrow(
      'Invalid --until value "2026-02-30T23:59:59Z". Expected an ISO 8601 date.',
    );
  });
});
