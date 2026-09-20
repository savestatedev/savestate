import { describe, expect, it } from 'vitest';
import { parseSearchUntil, resolveSearchSnapshots } from '../search.js';

describe('savestate search --until', () => {
  it('leaves the cutoff unset when omitted', () => {
    expect(parseSearchUntil(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseSearchUntil('2026-04-01')).toBe(new Date('2026-04-01').getTime());
    expect(parseSearchUntil('2026-04-01T00:00:00Z')).toBe(
      new Date('2026-04-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseSearchUntil(value)).toThrow(
        `Invalid --until value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );

  it('skips snapshots newer than the cutoff', () => {
    expect(
      resolveSearchSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-05-01T00:00:00Z' },
        ],
        { until: '2026-04-01' },
      ),
    ).toEqual(['old']);
  });

  it('ANDs --snapshot with --until', () => {
    expect(
      resolveSearchSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-05-01T00:00:00Z' },
        ],
        { snapshot: 'new', until: '2026-04-01' },
      ),
    ).toEqual([]);
    expect(
      resolveSearchSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-05-01T00:00:00Z' },
        ],
        { snapshot: 'old', until: '2026-04-01' },
      ),
    ).toEqual(['old']);
  });
});
