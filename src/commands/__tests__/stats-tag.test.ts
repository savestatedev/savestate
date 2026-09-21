import { describe, expect, it } from 'vitest';
import { applyStatsFilters, parseStatsTag } from '../stats.js';
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

describe('savestate stats --tag', () => {
  it('leaves the tag unset when omitted', () => {
    expect(parseStatsTag(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot tag', () => {
    expect(parseStatsTag('work')).toBe('work');
    expect(parseStatsTag('weekly')).toBe('weekly');
    expect(parseStatsTag(' v2 ')).toBe('v2');
  });

  it.each(['', ' ', ',', 'work,personal'])('rejects invalid value %s', (value) => {
    expect(() => parseStatsTag(value)).toThrow(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  });

  it('keeps snapshots that include the tag', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'work', tags: ['work'] }),
          entry({ id: 'personal', tags: ['personal'] }),
        ],
        { tag: 'work' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['work']);
  });

  it('ANDs --adapter with --tag', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'gpt-work', adapter: 'chatgpt', tags: ['work'] }),
          entry({ id: 'claude-work', adapter: 'claude-code', tags: ['work'] }),
          entry({ id: 'gpt-personal', adapter: 'chatgpt', tags: ['personal'] }),
        ],
        { adapter: 'chatgpt', tag: 'work' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['gpt-work']);
  });

  it('ANDs --since and --until with --tag', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'old', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] }),
          entry({ id: 'mid', timestamp: '2026-04-15T00:00:00Z', tags: ['work'] }),
          entry({ id: 'new', timestamp: '2026-08-01T00:00:00Z', tags: ['work'] }),
          entry({ id: 'mid-personal', timestamp: '2026-04-15T00:00:00Z', tags: ['personal'] }),
        ],
        { since: '2026-04-01', until: '2026-05-01', tag: 'work' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['mid']);
  });
});
