import { describe, expect, it } from 'vitest';
import { applyStatsFilters, parseStatsSince } from '../stats.js';
import type { SnapshotIndexEntry } from '../../index-file.js';

function entry(partial: Partial<SnapshotIndexEntry>): SnapshotIndexEntry {
  return {
    id: partial.id ?? 'ss-x',
    timestamp: partial.timestamp ?? '2026-01-01T00:00:00Z',
    platform: partial.platform ?? 'claude',
    adapter: partial.adapter ?? 'claude-code',
    filename: partial.filename ?? 'ss-x.saf.enc',
    size: partial.size ?? 1024,
    label: partial.label,
    tags: partial.tags,
  };
}

describe('savestate stats --since', () => {
  it('leaves the cutoff unset when omitted', () => {
    expect(parseStatsSince(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseStatsSince('2026-04-01')).toBe(new Date('2026-04-01').getTime());
    expect(parseStatsSince('2026-04-01T00:00:00Z')).toBe(
      new Date('2026-04-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseStatsSince(value)).toThrow(
        `Invalid --since value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );

  it('skips snapshots older than the cutoff', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'old', timestamp: '2026-01-01T00:00:00Z' }),
          entry({ id: 'new', timestamp: '2026-05-01T00:00:00Z' }),
        ],
        { since: '2026-04-01' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['new']);
  });
});
