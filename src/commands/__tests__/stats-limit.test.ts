import { describe, expect, it } from 'vitest';
import {
  applyStatsFilters,
  formatStatsEmptyState,
  getStatsNextOffset,
  parseStatsLimit,
  parseStatsOffset,
  sortStatsEntries,
} from '../stats.js';
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

describe('savestate stats --limit', () => {
  it.each(['1e2', '0x10', '1.5', ''])('rejects non-decimal integer %s', (value) => {
    expect(() => parseStatsLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it.each(['1e2', '0x10', '1.5', '', '-1'])('rejects non-decimal offset %s', (value) => {
    expect(() => parseStatsOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('leaves the snapshot set uncapped when omitted', () => {
    expect(parseStatsLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseStatsLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseStatsLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseStatsLimit('1000')).toBe(1000);
    expect(() => parseStatsLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the N most recent snapshots', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'old', timestamp: '2026-01-01T00:00:00Z' }),
          entry({ id: 'mid', timestamp: '2026-03-01T00:00:00Z' }),
          entry({ id: 'new', timestamp: '2026-05-01T00:00:00Z' }),
        ],
        { limit: '2' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['new', 'mid']);
  });

  it('advances an empty bounded page by the requested page size', () => {
    expect(getStatsNextOffset(10, 5, true)).toBe(15);
    expect(getStatsNextOffset(10, 5, false)).toBeNull();
    expect(getStatsNextOffset(10, null, true)).toBeNull();
  });

  it('explains how to recover from a stale empty page', () => {
    expect(formatStatsEmptyState(12, 15, 5)).toContain(
      'Try --offset 10 to open the nearest available page.',
    );
    expect(formatStatsEmptyState(0, 0, 5)).toBe('No snapshots match those filters.');
  });

  it('orders equal-timestamp snapshots by id for stable pagination', () => {
    expect(
      sortStatsEntries([
        entry({ id: 'ss-z' }),
        entry({ id: 'ss-a' }),
      ]).map((snapshot) => snapshot.id),
    ).toEqual(['ss-a', 'ss-z']);
  });

  it('ANDs --adapter with --limit', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'old-gpt', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
          entry({ id: 'mid-gpt', adapter: 'chatgpt', timestamp: '2026-03-01T00:00:00Z' }),
          entry({ id: 'new-gpt', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
          entry({ id: 'new-claude', adapter: 'claude-code', timestamp: '2026-06-01T00:00:00Z' }),
        ],
        { adapter: 'chatgpt', limit: '2' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['new-gpt', 'mid-gpt']);
  });

  it('ANDs --since with --limit', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'old', timestamp: '2026-01-01T00:00:00Z' }),
          entry({ id: 'mid', timestamp: '2026-04-15T00:00:00Z' }),
          entry({ id: 'new', timestamp: '2026-08-01T00:00:00Z' }),
        ],
        { since: '2026-04-01', limit: '1' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['new']);
  });
});
