import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import { parsePruneTag, planPrune } from '../prune.js';

function entry(
  partial: Pick<SnapshotIndexEntry, 'id' | 'adapter'> & Partial<SnapshotIndexEntry>,
): SnapshotIndexEntry {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    platform: partial.adapter,
    filename: `${partial.id}.saf.enc`,
    size: 1,
    ...partial,
  };
}

describe('savestate prune --tag', () => {
  it('defaults to undefined', () => {
    expect(parsePruneTag(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot tag', () => {
    expect(parsePruneTag('work')).toBe('work');
    expect(parsePruneTag('weekly')).toBe('weekly');
    expect(parsePruneTag(' v2 ')).toBe('v2');
  });

  it.each(['', ' ', ',', 'work,personal'])('rejects invalid value %s', (value) => {
    expect(() => parsePruneTag(value)).toThrow(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  });

  it('only drops snapshots that include the tag', () => {
    const plan = planPrune(
      [
        entry({ id: 'old-work', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] }),
        entry({ id: 'new-work', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z', tags: ['work'] }),
        entry({ id: 'old-personal', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z', tags: ['personal'] }),
      ],
      { keepLast: 1, tag: 'work' },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['old-work']);
    expect(plan.keep.map((snapshot) => snapshot.id)).toEqual(['new-work', 'old-personal']);
  });

  it('ANDs --adapter with --tag', () => {
    const plan = planPrune(
      [
        entry({ id: 'old-gpt-work', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] }),
        entry({ id: 'new-gpt-work', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z', tags: ['work'] }),
        entry({ id: 'old-claude-work', adapter: 'claude-code', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] }),
        entry({ id: 'old-gpt-personal', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z', tags: ['personal'] }),
      ],
      { keepLast: 1, adapter: 'chatgpt', tag: 'work' },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['old-gpt-work']);
    expect(plan.keep.map((snapshot) => snapshot.id)).toEqual([
      'new-gpt-work',
      'old-claude-work',
      'old-gpt-personal',
    ]);
  });

  it('ANDs --tag with --older-than', () => {
    const plan = planPrune(
      [
        entry({ id: 'old-work', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] }),
        entry({ id: 'new-work', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z', tags: ['work'] }),
        entry({ id: 'old-personal', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z', tags: ['personal'] }),
      ],
      { olderThanMs: Date.parse('2026-04-01'), tag: 'work' },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['old-work']);
    expect(plan.keep.map((snapshot) => snapshot.id)).toEqual(['new-work', 'old-personal']);
  });
});
