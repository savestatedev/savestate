import { describe, expect, it } from 'vitest';
import { parseRestoreSince, resolveRestoreSnapshot } from '../restore.js';

describe('savestate restore --since', () => {
  it('defaults to undefined', () => {
    expect(parseRestoreSince(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseRestoreSince('2026-04-01')).toBe(new Date('2026-04-01').getTime());
    expect(parseRestoreSince('2026-04-01T00:00:00Z')).toBe(
      new Date('2026-04-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseRestoreSince(value)).toThrow(
        `Invalid --since value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );

  it('picks the newest snapshot taken after the cutoff', () => {
    expect(
      resolveRestoreSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { since: '2026-04-01' },
      ),
    ).toEqual('new');
  });

  it('ANDs --tag with --since', () => {
    expect(
      resolveRestoreSnapshot(
        [
          { id: 'old-work', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'mid-work', timestamp: '2026-05-01T00:00:00Z', tags: ['work'] },
          { id: 'new-personal', timestamp: '2026-08-01T00:00:00Z', tags: ['personal'] },
        ],
        { tag: 'work', since: '2026-04-01' },
      ),
    ).toEqual('mid-work');
  });

  it('returns undefined when snapshot-id is before --since', () => {
    expect(
      resolveRestoreSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { snapshot: 'old', since: '2026-04-01' },
      ),
    ).toBeUndefined();
  });
});
