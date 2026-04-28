/**
 * Tests for computeStats — the snapshot statistics aggregator.
 */

import { describe, it, expect } from 'vitest';
import { computeStats } from '../commands/stats.js';
import type { SnapshotIndexEntry } from '../index-file.js';

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

describe('computeStats', () => {
  it('returns zero stats for empty input', () => {
    const stats = computeStats([]);
    expect(stats.total).toBe(0);
    expect(stats.totalBytes).toBe(0);
    expect(stats.first).toBeNull();
    expect(stats.latest).toBeNull();
    expect(stats.spanDays).toBeNull();
  });

  it('aggregates totals and averages', () => {
    const stats = computeStats([
      entry({ id: 'a', size: 1000 }),
      entry({ id: 'b', size: 2000 }),
      entry({ id: 'c', size: 3000 }),
    ]);
    expect(stats.total).toBe(3);
    expect(stats.totalBytes).toBe(6000);
    expect(stats.avgBytes).toBe(2000);
    expect(stats.maxBytes).toBe(3000);
  });

  it('groups by adapter and platform', () => {
    const stats = computeStats([
      entry({ id: 'a', adapter: 'claude-code', platform: 'claude' }),
      entry({ id: 'b', adapter: 'claude-code', platform: 'claude' }),
      entry({ id: 'c', adapter: 'chatgpt', platform: 'openai' }),
    ]);
    expect(stats.byAdapter['claude-code']).toBe(2);
    expect(stats.byAdapter['chatgpt']).toBe(1);
    expect(stats.byPlatform['claude']).toBe(2);
    expect(stats.byPlatform['openai']).toBe(1);
  });

  it('counts top tags by frequency', () => {
    const stats = computeStats([
      entry({ id: 'a', tags: ['work', 'pinned'] }),
      entry({ id: 'b', tags: ['work'] }),
      entry({ id: 'c', tags: ['personal'] }),
    ]);
    expect(stats.tagCount).toBe(3);
    expect(stats.topTags[0]).toEqual(['work', 2]);
  });

  it('computes time span and cadence across snapshots', () => {
    const stats = computeStats([
      entry({ id: 'a', timestamp: '2026-01-01T00:00:00Z' }),
      entry({ id: 'b', timestamp: '2026-01-02T00:00:00Z' }),
      entry({ id: 'c', timestamp: '2026-01-03T00:00:00Z' }),
    ]);
    expect(stats.spanDays).toBe(2);
    expect(stats.cadenceHours).toBeCloseTo(24, 0);
    expect(stats.first).toBe('2026-01-01T00:00:00Z');
    expect(stats.latest).toBe('2026-01-03T00:00:00Z');
  });

  it('handles a single snapshot without dividing by zero', () => {
    const stats = computeStats([entry({ id: 'only' })]);
    expect(stats.total).toBe(1);
    expect(stats.cadenceHours).toBeNull();
    expect(stats.spanDays).toBeNull();
  });
});
