import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import { parsePruneLabel, planPrune } from '../prune.js';

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

describe('savestate prune --label', () => {
  it('leaves the label unset when omitted', () => {
    expect(parsePruneLabel(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot label', () => {
    expect(parsePruneLabel('backup')).toBe('backup');
    expect(parsePruneLabel('Pre-update backup')).toBe('Pre-update backup');
    expect(parsePruneLabel(' nightly ')).toBe('nightly');
  });

  it.each(['', ' ', ',', 'backup,nightly'])('rejects invalid value %s', (value) => {
    expect(() => parsePruneLabel(value)).toThrow(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  });

  it('only considers snapshots that match the label', () => {
    const plan = planPrune(
      [
        entry({ id: 'old', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z', label: 'backup' }),
        entry({ id: 'mid', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z', label: 'nightly' }),
        entry({ id: 'new', adapter: 'chatgpt', timestamp: '2026-08-01T00:00:00Z', label: 'backup' }),
      ],
      { keepLast: 1, label: 'backup' },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['old']);
    expect(plan.keep.map((snapshot) => snapshot.id).sort()).toEqual(['mid', 'new']);
  });

  it('ANDs --adapter with --label', () => {
    const plan = planPrune(
      [
        entry({ id: 'old-gpt', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z', label: 'backup' }),
        entry({ id: 'new-gpt', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z', label: 'backup' }),
        entry({ id: 'old-claude', adapter: 'claude-code', timestamp: '2026-01-01T00:00:00Z', label: 'backup' }),
        entry({ id: 'gpt-nightly', adapter: 'chatgpt', timestamp: '2026-08-01T00:00:00Z', label: 'nightly' }),
      ],
      { keepLast: 1, adapter: 'chatgpt', label: 'backup' },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['old-gpt']);
    expect(plan.keep.map((snapshot) => snapshot.id).sort()).toEqual([
      'gpt-nightly',
      'new-gpt',
      'old-claude',
    ]);
  });

  it('ANDs --label with --older-than', () => {
    const plan = planPrune(
      [
        entry({ id: 'old', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z', label: 'backup' }),
        entry({ id: 'mid', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z', label: 'backup' }),
        entry({ id: 'new', adapter: 'chatgpt', timestamp: '2026-08-01T00:00:00Z', label: 'backup' }),
        entry({ id: 'old-nightly', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z', label: 'nightly' }),
      ],
      { olderThanMs: Date.parse('2026-04-01'), label: 'backup' },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['old']);
    expect(plan.keep.map((snapshot) => snapshot.id).sort()).toEqual(['mid', 'new', 'old-nightly']);
  });
});
