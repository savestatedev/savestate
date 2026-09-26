import { describe, expect, it } from 'vitest';
import { parseMigrateSince, resolveMigrateSnapshot } from '../migrate.js';

describe('savestate migrate --since', () => {
  it('defaults to undefined', () => {
    expect(parseMigrateSince(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseMigrateSince('2026-04-01')).toBe(new Date('2026-04-01').getTime());
    expect(parseMigrateSince('2026-04-01T00:00:00Z')).toBe(
      new Date('2026-04-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseMigrateSince(value)).toThrow(
        `Invalid --since value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );

  it('picks the newest snapshot taken after the cutoff', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { since: '2026-04-01' },
      ),
    ).toEqual('new');
  });

  it('ANDs --label with --since', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'old-backup', timestamp: '2026-01-01T00:00:00Z', label: 'backup' },
          { id: 'mid-backup', timestamp: '2026-05-01T00:00:00Z', label: 'backup' },
          { id: 'new-nightly', timestamp: '2026-08-01T00:00:00Z', label: 'nightly' },
        ],
        { label: 'backup', since: '2026-04-01' },
      ),
    ).toEqual('mid-backup');
  });

  it('returns undefined when snapshot-id is before --since', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { snapshot: 'old', since: '2026-04-01' },
      ),
    ).toBeUndefined();
  });
});
