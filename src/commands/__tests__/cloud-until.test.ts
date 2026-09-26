import { describe, expect, it } from 'vitest';
import { parseCloudUntil, resolveCloudPushSnapshots } from '../cloud.js';

describe('savestate cloud --until', () => {
  it('defaults to undefined', () => {
    expect(parseCloudUntil(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseCloudUntil('2026-06-01')).toBe(new Date('2026-06-01').getTime());
    expect(parseCloudUntil('2026-06-01T00:00:00Z')).toBe(
      new Date('2026-06-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseCloudUntil(value)).toThrow(
        `Invalid --until value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );

  it('picks the newest snapshot taken on or before the cutoff', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { until: '2026-06-01' },
      ).map((entry) => entry.id),
    ).toEqual(['mid']);
  });

  it('ANDs --id with --until', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { id: 'mid', until: '2026-06-01' },
      ).map((entry) => entry.id),
    ).toEqual(['mid']);
  });

  it('returns empty when snapshot-id is after --until', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { id: 'new', until: '2026-04-01' },
      ),
    ).toEqual([]);
  });

  it('ANDs --since with --until', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { since: '2026-04-01', until: '2026-06-01' },
      ).map((entry) => entry.id),
    ).toEqual(['mid']);
  });

  it('returns every matching snapshot with --all', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { until: '2026-06-01', all: true },
      ).map((entry) => entry.id),
    ).toEqual(['old', 'mid']);
  });
});
