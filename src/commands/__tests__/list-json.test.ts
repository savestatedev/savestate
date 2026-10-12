import { describe, expect, it } from 'vitest';
import { formatListJson, type ListJson } from '../list.js';
import type { SnapshotIndexEntry } from '../../index-file.js';

const older: SnapshotIndexEntry = {
  id: 'ss-older',
  timestamp: '2026-01-25T09:30:00.000Z',
  platform: 'claude-code',
  adapter: 'claude-code',
  filename: 'ss-older.saf.enc',
  size: 2048,
};

const newer: SnapshotIndexEntry = {
  id: 'ss-newer',
  timestamp: '2026-01-26T09:30:00.000Z',
  platform: 'claude-code',
  adapter: 'claude-code',
  label: 'pre-update',
  tags: ['weekly'],
  filename: 'ss-newer.saf.enc',
  size: 4096,
};

describe('savestate list --json', () => {
  it('prints snapshot records as JSON newest first', () => {
    const parsed = JSON.parse(formatListJson([older, newer])) as ListJson;
    expect(parsed.total).toBe(2);
    expect(parsed.shown).toBe(2);
    expect(parsed.entries[0]?.id).toBe('ss-newer');
    expect(parsed.entries[0]?.label).toBe('pre-update');
    expect(parsed.entries[0]?.tags).toEqual(['weekly']);
    expect(parsed.entries[0]?.filename).toBe('ss-newer.saf.enc');
    expect(parsed.entries[0]?.size).toBe(4096);
    expect(parsed.entries[1]?.id).toBe('ss-older');
  });

  it('records missing label as null and missing tags as []', () => {
    const parsed = JSON.parse(formatListJson([older], 1)) as ListJson;
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]?.id).toBe('ss-older');
    expect(parsed.entries[0]?.label).toBeNull();
    expect(parsed.entries[0]?.tags).toEqual([]);
  });

  it('prints an empty array when there are no snapshots', () => {
    expect(JSON.parse(formatListJson([]))).toMatchObject({
      total: 0,
      shown: 0,
      page: 1,
      totalPages: 0,
      entries: [],
    });
  });

  it('supports oldest-first ordering for JSON consumers', () => {
    const parsed = JSON.parse(formatListJson([older, newer], 50, undefined, true)) as ListJson;
    expect(parsed.entries.map((snapshot) => snapshot.id)).toEqual(['ss-older', 'ss-newer']);
  });

  it('reports navigation metadata for bounded pages', () => {
    const parsed = JSON.parse(formatListJson([older, newer], 1, 1)) as ListJson;
    expect(parsed).toMatchObject({
      total: 2,
      shown: 1,
      offset: 1,
      limit: 1,
      pageSize: 1,
      page: 2,
      totalPages: 2,
      hasPrevious: true,
      previousOffset: 0,
      hasMore: false,
      nextOffset: null,
    });
    expect(parsed.entries[0]?.id).toBe('ss-older');
  });
});
