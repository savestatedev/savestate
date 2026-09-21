import { describe, expect, it } from 'vitest';
import { applyStatsFilters, parseStatsLimit } from '../stats.js';
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
