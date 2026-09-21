import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import { parsePruneLimit, planPrune } from '../prune.js';

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

describe('savestate prune --limit', () => {
  it('leaves the snapshot set uncapped when omitted', () => {
    expect(parsePruneLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parsePruneLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parsePruneLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parsePruneLimit('1000')).toBe(1000);
    expect(() => parsePruneLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('only considers the N most recent snapshots', () => {
    const plan = planPrune(
      [
        entry({ id: 'old', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'mid', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        entry({ id: 'new', adapter: 'chatgpt', timestamp: '2026-08-01T00:00:00Z' }),
      ],
      { keepLast: 1, limit: 2 },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['mid']);
    expect(plan.keep.map((snapshot) => snapshot.id).sort()).toEqual(['new', 'old']);
  });

  it('ANDs --adapter with --limit', () => {
    const plan = planPrune(
      [
        entry({ id: 'old-gpt', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'mid-gpt', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        entry({ id: 'new-gpt', adapter: 'chatgpt', timestamp: '2026-08-01T00:00:00Z' }),
        entry({ id: 'new-claude', adapter: 'claude-code', timestamp: '2026-09-01T00:00:00Z' }),
      ],
      { keepLast: 1, adapter: 'chatgpt', limit: 2 },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['mid-gpt']);
    expect(plan.keep.map((snapshot) => snapshot.id).sort()).toEqual([
      'new-claude',
      'new-gpt',
      'old-gpt',
    ]);
  });

  it('ANDs --limit with --older-than', () => {
    const plan = planPrune(
      [
        entry({ id: 'old', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'mid', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        entry({ id: 'new', adapter: 'chatgpt', timestamp: '2026-08-01T00:00:00Z' }),
      ],
      { olderThanMs: Date.parse('2026-04-01'), limit: 2 },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual([]);
    expect(plan.keep.map((snapshot) => snapshot.id).sort()).toEqual(['mid', 'new', 'old']);
  });
});
