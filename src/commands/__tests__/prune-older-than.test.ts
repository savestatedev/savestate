import { describe, expect, it } from 'vitest';
import { parsePruneOlderThan } from '../prune.js';

describe('savestate prune --older-than', () => {
  it('leaves the cutoff unset when omitted', () => {
    expect(parsePruneOlderThan(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parsePruneOlderThan('2026-01-01')).toBe(Date.parse('2026-01-01'));
    expect(parsePruneOlderThan('2026-01-01T00:00:00Z')).toBe(
      Date.parse('2026-01-01T00:00:00Z'),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parsePruneOlderThan(value)).toThrow(
        `Invalid --older-than value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );
});
