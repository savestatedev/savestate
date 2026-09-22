import { describe, expect, it } from 'vitest';
import { parseInspectSince, resolveInspectSnapshot } from '../inspect.js';

describe('savestate inspect --since', () => {
  it('defaults to undefined', () => {
    expect(parseInspectSince(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseInspectSince('2026-04-01')).toBe(new Date('2026-04-01').getTime());
    expect(parseInspectSince('2026-04-01T00:00:00Z')).toBe(
      new Date('2026-04-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseInspectSince(value)).toThrow(
        `Invalid --since value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );

  it('picks the newest snapshot taken after the cutoff', () => {
    expect(
      resolveInspectSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { snapshot: 'latest', since: '2026-04-01' },
      ),
    ).toEqual('new');
  });

  it('ANDs --tag with --since', () => {
    expect(
      resolveInspectSnapshot(
        [
          { id: 'old-work', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'mid-work', timestamp: '2026-05-01T00:00:00Z', tags: ['work'] },
          { id: 'new-personal', timestamp: '2026-08-01T00:00:00Z', tags: ['personal'] },
        ],
        { snapshot: 'latest', tag: 'work', since: '2026-04-01' },
      ),
    ).toEqual('mid-work');
  });

  it('returns undefined when snapshot-id is before --since', () => {
    expect(
      resolveInspectSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { snapshot: 'old', since: '2026-04-01' },
      ),
    ).toBeUndefined();
  });
});
