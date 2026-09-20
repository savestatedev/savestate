import { describe, expect, it } from 'vitest';
import { parseSearchSince, resolveSearchSnapshots } from '../search.js';

describe('savestate search --since', () => {
  it('leaves the cutoff unset when omitted', () => {
    expect(parseSearchSince(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseSearchSince('2026-04-01')).toBe(new Date('2026-04-01').getTime());
    expect(parseSearchSince('2026-04-01T00:00:00Z')).toBe(
      new Date('2026-04-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseSearchSince(value)).toThrow(
        `Invalid --since value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );

  it('skips snapshots older than the cutoff', () => {
    expect(
      resolveSearchSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-05-01T00:00:00Z' },
        ],
        { since: '2026-04-01' },
      ),
    ).toEqual(['new']);
  });

  it('ANDs --snapshot with --since', () => {
    expect(
      resolveSearchSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-05-01T00:00:00Z' },
        ],
        { snapshot: 'old', since: '2026-04-01' },
      ),
    ).toEqual([]);
    expect(
      resolveSearchSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-05-01T00:00:00Z' },
        ],
        { snapshot: 'new', since: '2026-04-01' },
      ),
    ).toEqual(['new']);
  });
});
