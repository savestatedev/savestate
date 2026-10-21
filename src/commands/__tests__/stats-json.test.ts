import { describe, expect, it } from 'vitest';
import { formatStatsJson, type StatsJson } from '../stats.js';
import type { SnapshotIndexEntry } from '../../index-file.js';

const older: SnapshotIndexEntry = {
  id: 'ss-older',
  timestamp: '2026-01-25T09:30:00.000Z',
  platform: 'claude',
  adapter: 'claude-code',
  filename: 'ss-older.saf.enc',
  size: 2048,
  tags: ['work'],
};

const newer: SnapshotIndexEntry = {
  id: 'ss-newer',
  timestamp: '2026-01-26T09:30:00.000Z',
  platform: 'claude',
  adapter: 'claude-code',
  filename: 'ss-newer.saf.enc',
  size: 4096,
  tags: ['work', 'weekly'],
};

describe('savestate stats --json', () => {
  it('prints usage statistics as JSON with storage type', () => {
    const parsed = JSON.parse(formatStatsJson([older, newer], 'local')) as StatsJson;
    expect(parsed.total).toBe(2);
    expect(parsed.totalBytes).toBe(6144);
    expect(parsed.avgBytes).toBe(3072);
    expect(parsed.maxBytes).toBe(4096);
    expect(parsed.first).toBe('2026-01-25T09:30:00.000Z');
    expect(parsed.latest).toBe('2026-01-26T09:30:00.000Z');
    expect(parsed.byAdapter).toEqual({ 'claude-code': 2 });
    expect(parsed.byPlatform).toEqual({ claude: 2 });
    expect(parsed.tagCount).toBe(2);
    expect(parsed.topTags).toEqual([
      { tag: 'work', count: 2 },
      { tag: 'weekly', count: 1 },
    ]);
    expect(parsed.storage).toEqual({ type: 'local' });
    expect(parsed.pagination).toEqual({
      total: 2,
      shown: 2,
      offset: 0,
      limit: null,
      emptyReason: null,
      suggestedOffset: null,
      hasPrevious: false,
      previousOffset: null,
      hasMore: false,
      nextOffset: null,
    });
  });

  it('records empty snapshot stats with null first and latest', () => {
    const parsed = JSON.parse(formatStatsJson([], 'local')) as StatsJson;
    expect(parsed.total).toBe(0);
    expect(parsed.totalBytes).toBe(0);
    expect(parsed.first).toBeNull();
    expect(parsed.latest).toBeNull();
    expect(parsed.spanDays).toBeNull();
    expect(parsed.cadenceHours).toBeNull();
    expect(parsed.topTags).toEqual([]);
    expect(parsed.storage).toEqual({ type: 'local' });
    expect(parsed.pagination.emptyReason).toBe('collection');
    expect(parsed.pagination.suggestedOffset).toBeNull();
  });

  it('preserves page navigation metadata for aggregate JSON', () => {
    const parsed = JSON.parse(formatStatsJson([newer], 'local', {
      total: 3,
      shown: 1,
      offset: 1,
      limit: 1,
      emptyReason: null,
      suggestedOffset: null,
      hasPrevious: true,
      previousOffset: 0,
      hasMore: true,
      nextOffset: 2,
    })) as StatsJson;

    expect(parsed.total).toBe(1);
    expect(parsed.pagination).toEqual({
      total: 3,
      shown: 1,
      offset: 1,
      limit: 1,
      emptyReason: null,
      suggestedOffset: null,
      hasPrevious: true,
      previousOffset: 0,
      hasMore: true,
      nextOffset: 2,
    });
  });

  it('suggests the nearest valid page when the offset is exhausted', () => {
    const parsed = JSON.parse(formatStatsJson([], 'local', {
      total: 3,
      shown: 0,
      offset: 8,
      limit: 2,
      emptyReason: 'page',
      suggestedOffset: 2,
      hasPrevious: true,
      previousOffset: 6,
      hasMore: false,
      nextOffset: null,
    })) as StatsJson;

    expect(parsed.pagination).toMatchObject({
      emptyReason: 'page',
      suggestedOffset: 2,
    });
  });

  it('orders equally used tags alphabetically for stable output', () => {
    const parsed = JSON.parse(formatStatsJson([
      { ...older, tags: ['zebra', 'alpha'] },
      { ...newer, tags: ['alpha', 'zebra'] },
    ], 'local')) as StatsJson;

    expect(parsed.topTags).toEqual([
      { tag: 'alpha', count: 2 },
      { tag: 'zebra', count: 2 },
    ]);
  });
});
