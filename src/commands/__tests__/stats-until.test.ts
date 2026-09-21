import { describe, expect, it } from 'vitest';
import { applyStatsFilters, parseStatsUntil } from '../stats.js';
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

describe('savestate stats --until', () => {
  it('leaves the cutoff unset when omitted', () => {
    expect(parseStatsUntil(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseStatsUntil('2026-04-01')).toBe(new Date('2026-04-01').getTime());
    expect(parseStatsUntil('2026-04-01T00:00:00Z')).toBe(
      new Date('2026-04-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseStatsUntil(value)).toThrow(
        `Invalid --until value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );

  it('skips snapshots newer than the cutoff', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'old', timestamp: '2026-01-01T00:00:00Z' }),
          entry({ id: 'new', timestamp: '2026-05-01T00:00:00Z' }),
        ],
        { until: '2026-04-01' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['old']);
  });

  it('ANDs --adapter with --until', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'old-gpt', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
          entry({ id: 'old-claude', adapter: 'claude-code', timestamp: '2026-01-01T00:00:00Z' }),
          entry({ id: 'new', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        ],
        { adapter: 'chatgpt', until: '2026-04-01' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['old-gpt']);
  });

  it('ANDs --since with --until', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'old', timestamp: '2026-01-01T00:00:00Z' }),
          entry({ id: 'mid', timestamp: '2026-04-15T00:00:00Z' }),
          entry({ id: 'new', timestamp: '2026-08-01T00:00:00Z' }),
        ],
        { since: '2026-04-01', until: '2026-05-01' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['mid']);
  });
});
