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
  });
});
