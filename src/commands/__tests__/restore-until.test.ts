import { describe, expect, it } from 'vitest';
import { parseRestoreUntil, resolveRestoreSnapshot } from '../restore.js';

describe('savestate restore --until', () => {
  it('defaults to undefined', () => {
    expect(parseRestoreUntil(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseRestoreUntil('2026-06-01')).toBe(new Date('2026-06-01').getTime());
    expect(parseRestoreUntil('2026-06-01T00:00:00Z')).toBe(
      new Date('2026-06-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseRestoreUntil(value)).toThrow(
        `Invalid --until value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );

  it('picks the newest snapshot taken on or before the cutoff', () => {
    expect(
      resolveRestoreSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { snapshot: 'latest', until: '2026-06-01' },
      ),
    ).toEqual('mid');
  });

  it('ANDs --tag with --until', () => {
    expect(
      resolveRestoreSnapshot(
        [
          { id: 'old-work', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'mid-work', timestamp: '2026-05-01T00:00:00Z', tags: ['work'] },
          { id: 'new-personal', timestamp: '2026-08-01T00:00:00Z', tags: ['personal'] },
        ],
        { snapshot: 'latest', tag: 'work', until: '2026-06-01' },
      ),
    ).toEqual('mid-work');
  });

  it('returns undefined when snapshot-id is after --until', () => {
    expect(
      resolveRestoreSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { snapshot: 'new', until: '2026-04-01' },
      ),
    ).toBeUndefined();
  });
});
