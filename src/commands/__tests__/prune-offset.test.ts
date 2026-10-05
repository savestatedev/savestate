import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import { parsePruneOffset, planPrune, selectPruneOffsetEntries } from '../prune.js';

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

describe('savestate prune --offset', () => {
  it('defaults to undefined', () => {
    expect(parsePruneOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parsePruneOffset('0')).toBe(0);
    expect(parsePruneOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parsePruneOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parsePruneOffset('1000')).toBe(1000);
    expect(() => parsePruneOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N snapshots', () => {
    expect(
      selectPruneOffsetEntries(
        [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        1,
      ).map((snapshot) => snapshot.id),
    ).toEqual(['s2', 's3']);
  });

  it('returns all snapshots when offset is omitted', () => {
    const entries = [{ id: 's1' }, { id: 's2' }];
    expect(selectPruneOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips the newest snapshots before applying keep-last', () => {
    const plan = planPrune(
      [
        entry({ id: 'old', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'mid', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        entry({ id: 'new', adapter: 'chatgpt', timestamp: '2026-08-01T00:00:00Z' }),
      ],
      { keepLast: 1, offset: 1 },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['old']);
    expect(plan.keep.map((snapshot) => snapshot.id).sort()).toEqual(['mid', 'new']);
  });

  it('ANDs --offset with --limit', () => {
    const plan = planPrune(
      [
        entry({ id: 'old', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'mid', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        entry({ id: 'new', adapter: 'chatgpt', timestamp: '2026-08-01T00:00:00Z' }),
      ],
      { keepLast: 1, offset: 1, limit: 1 },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual([]);
    expect(plan.keep.map((snapshot) => snapshot.id).sort()).toEqual(['mid', 'new', 'old']);
  });
});
