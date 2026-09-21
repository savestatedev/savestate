import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import { parsePruneSince, planPrune } from '../prune.js';

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

describe('savestate prune --since', () => {
  it('leaves the cutoff unset when omitted', () => {
    expect(parsePruneSince(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parsePruneSince('2026-04-01')).toBe(new Date('2026-04-01').getTime());
    expect(parsePruneSince('2026-04-01T00:00:00Z')).toBe(
      new Date('2026-04-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parsePruneSince(value)).toThrow(
        `Invalid --since value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );

  it('only drops snapshots taken after the cutoff', () => {
    const plan = planPrune(
      [
        entry({ id: 'old', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'mid', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        entry({ id: 'new', adapter: 'chatgpt', timestamp: '2026-08-01T00:00:00Z' }),
      ],
      { keepLast: 1, sinceMs: Date.parse('2026-04-01') },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['mid']);
    expect(plan.keep.map((snapshot) => snapshot.id)).toEqual(['new', 'old']);
  });

  it('ANDs --adapter with --since', () => {
    const plan = planPrune(
      [
        entry({ id: 'old-gpt', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'mid-gpt', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        entry({ id: 'new-gpt', adapter: 'chatgpt', timestamp: '2026-08-01T00:00:00Z' }),
        entry({ id: 'mid-claude', adapter: 'claude-code', timestamp: '2026-05-01T00:00:00Z' }),
      ],
      { keepLast: 1, adapter: 'chatgpt', sinceMs: Date.parse('2026-04-01') },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['mid-gpt']);
    expect(plan.keep.map((snapshot) => snapshot.id)).toEqual(['new-gpt', 'old-gpt', 'mid-claude']);
  });

  it('ANDs --since with --older-than', () => {
    const plan = planPrune(
      [
        entry({ id: 'old', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'mid', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        entry({ id: 'new', adapter: 'chatgpt', timestamp: '2026-08-01T00:00:00Z' }),
      ],
      { olderThanMs: Date.parse('2026-06-01'), sinceMs: Date.parse('2026-04-01') },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['mid']);
    expect(plan.keep.map((snapshot) => snapshot.id)).toEqual(['new', 'old']);
  });
});
