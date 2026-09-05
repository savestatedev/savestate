import { describe, expect, it } from 'vitest';
import { formatListJson, type ListSnapshotJson } from '../list.js';
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
    const parsed = JSON.parse(formatListJson([older, newer])) as ListSnapshotJson[];
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.id).toBe('ss-newer');
    expect(parsed[0]?.label).toBe('pre-update');
    expect(parsed[0]?.tags).toEqual(['weekly']);
    expect(parsed[0]?.filename).toBe('ss-newer.saf.enc');
    expect(parsed[0]?.size).toBe(4096);
    expect(parsed[1]?.id).toBe('ss-older');
  });

  it('records missing label as null and missing tags as []', () => {
    const parsed = JSON.parse(formatListJson([older], 1)) as ListSnapshotJson[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBe('ss-older');
    expect(parsed[0]?.label).toBeNull();
    expect(parsed[0]?.tags).toEqual([]);
  });

  it('prints an empty array when there are no snapshots', () => {
    expect(formatListJson([])).toBe('[]');
  });
});
