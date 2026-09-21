import { describe, expect, it } from 'vitest';
import { applyStatsFilters, parseStatsSnapshot } from '../stats.js';
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

describe('savestate stats --snapshot', () => {
  it('leaves the id unset when omitted', () => {
    expect(parseStatsSnapshot(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot id', () => {
    expect(parseStatsSnapshot('ss-2026-09-13T12-00-00-ab12cd')).toBe(
      'ss-2026-09-13T12-00-00-ab12cd',
    );
    expect(parseStatsSnapshot(' abc123 ')).toBe('abc123');
  });

  it.each(['', ' ', ',', 'ss-1,ss-2', 'ss 1'])('rejects invalid value %s', (value) => {
    expect(() => parseStatsSnapshot(value)).toThrow(
      `Invalid --snapshot value "${value}". Expected a single non-empty snapshot id.`,
    );
  });

  it('keeps only the matching snapshot', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'keep', timestamp: '2026-01-01T00:00:00Z' }),
          entry({ id: 'skip', timestamp: '2026-05-01T00:00:00Z' }),
        ],
        { snapshot: 'keep' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['keep']);
  });

  it('ANDs --adapter with --snapshot', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'keep', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
          entry({ id: 'keep', adapter: 'claude-code', timestamp: '2026-01-01T00:00:00Z' }),
          entry({ id: 'skip', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        ],
        { adapter: 'chatgpt', snapshot: 'keep' },
      ).map((snapshot) => snapshot.adapter),
    ).toEqual(['chatgpt']);
  });
});
