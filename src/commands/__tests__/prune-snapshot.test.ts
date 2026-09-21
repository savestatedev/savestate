import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import { parsePruneSnapshot, planPrune } from '../prune.js';

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

describe('savestate prune --snapshot', () => {
  it('leaves the id unset when omitted', () => {
    expect(parsePruneSnapshot(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot id', () => {
    expect(parsePruneSnapshot('ss-2026-09-13T12-00-00-ab12cd')).toBe(
      'ss-2026-09-13T12-00-00-ab12cd',
    );
    expect(parsePruneSnapshot(' abc123 ')).toBe('abc123');
  });

  it.each(['', ' ', ',', 'ss-1,ss-2', 'ss 1'])('rejects invalid value %s', (value) => {
    expect(() => parsePruneSnapshot(value)).toThrow(
      `Invalid --snapshot value "${value}". Expected a single non-empty snapshot id.`,
    );
  });

  it('only considers the matching snapshot', () => {
    const plan = planPrune(
      [
        entry({ id: 'old', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'mid', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        entry({ id: 'new', adapter: 'chatgpt', timestamp: '2026-08-01T00:00:00Z' }),
      ],
      { keepLast: 1, snapshot: 'old' },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual([]);
    expect(plan.keep.map((snapshot) => snapshot.id).sort()).toEqual(['mid', 'new', 'old']);
  });

  it('ANDs --adapter with --snapshot', () => {
    const missed = planPrune(
      [
        entry({ id: 'keep', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'keep', adapter: 'claude-code', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'skip', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
      ],
      { keepLast: 1, adapter: 'claude-code', snapshot: 'keep' },
    );
    expect(missed.drop.map((snapshot) => snapshot.id)).toEqual([]);
    expect(missed.keep.map((snapshot) => snapshot.id).sort()).toEqual(['keep', 'keep', 'skip']);

    const plan = planPrune(
      [
        entry({ id: 'old-gpt', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'new-gpt', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        entry({ id: 'old-claude', adapter: 'claude-code', timestamp: '2026-01-01T00:00:00Z' }),
      ],
      { keepLast: 1, adapter: 'chatgpt', snapshot: 'old-gpt' },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual([]);
    expect(plan.keep.map((snapshot) => snapshot.id).sort()).toEqual([
      'new-gpt',
      'old-claude',
      'old-gpt',
    ]);
  });

  it('ANDs --snapshot with --older-than', () => {
    const plan = planPrune(
      [
        entry({ id: 'old', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'mid', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        entry({ id: 'new', adapter: 'chatgpt', timestamp: '2026-08-01T00:00:00Z' }),
      ],
      { olderThanMs: Date.parse('2026-04-01'), snapshot: 'old' },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual([]);
    expect(plan.keep.map((snapshot) => snapshot.id).sort()).toEqual(['mid', 'new', 'old']);
  });
});
