import { describe, expect, it } from 'vitest';
import { parseCloudSince, resolveCloudPushSnapshots } from '../cloud.js';

describe('savestate cloud --since', () => {
  it('defaults to undefined', () => {
    expect(parseCloudSince(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseCloudSince('2026-04-01')).toBe(new Date('2026-04-01').getTime());
    expect(parseCloudSince('2026-04-01T00:00:00Z')).toBe(
      new Date('2026-04-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseCloudSince(value)).toThrow(
        `Invalid --since value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );

  it('picks the newest snapshot taken after the cutoff', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { since: '2026-04-01' },
      ).map((entry) => entry.id),
    ).toEqual(['new']);
  });

  it('ANDs --id with --since', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { id: 'mid', since: '2026-04-01' },
      ).map((entry) => entry.id),
    ).toEqual(['mid']);
  });

  it('returns empty when snapshot-id is before --since', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { id: 'old', since: '2026-04-01' },
      ),
    ).toEqual([]);
  });

  it('returns every matching snapshot with --all', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { since: '2026-04-01', all: true },
      ).map((entry) => entry.id),
    ).toEqual(['mid', 'new']);
  });
});
