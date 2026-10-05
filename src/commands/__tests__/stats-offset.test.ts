import { describe, expect, it } from 'vitest';
import { applyStatsFilters, parseStatsOffset, selectStatsOffsetEntries } from '../stats.js';
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

describe('savestate stats --offset', () => {
  it('defaults to undefined', () => {
    expect(parseStatsOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseStatsOffset('0')).toBe(0);
    expect(parseStatsOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseStatsOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseStatsOffset('1000')).toBe(1000);
    expect(() => parseStatsOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N snapshots', () => {
    expect(
      selectStatsOffsetEntries(
        [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        1,
      ).map((snapshot) => snapshot.id),
    ).toEqual(['s2', 's3']);
  });

  it('returns all snapshots when offset is omitted', () => {
    const entries = [{ id: 's1' }, { id: 's2' }];
    expect(selectStatsOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips the newest snapshots before --limit', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'old', timestamp: '2026-01-01T00:00:00Z' }),
          entry({ id: 'mid', timestamp: '2026-03-01T00:00:00Z' }),
          entry({ id: 'new', timestamp: '2026-05-01T00:00:00Z' }),
        ],
        { offset: '1', limit: '1' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['mid']);
  });
});
