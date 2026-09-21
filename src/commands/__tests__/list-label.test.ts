import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import { applyListFilters, parseListLabel } from '../list.js';

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

describe('savestate list --label', () => {
  it('leaves the label unset when omitted', () => {
    expect(parseListLabel(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot label', () => {
    expect(parseListLabel('auto')).toBe('auto');
    expect(parseListLabel('Before migration')).toBe('Before migration');
    expect(parseListLabel(' Pre-update backup ')).toBe('Pre-update backup');
  });

  it.each(['', ' ', ',', 'pre,post'])('rejects invalid value %s', (value) => {
    expect(() => parseListLabel(value)).toThrow(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  });

  it('keeps only snapshots with the matching label', () => {
    expect(
      applyListFilters(
        [
          entry({ id: 'keep', adapter: 'chatgpt', label: 'Pre-update backup' }),
          entry({ id: 'skip', adapter: 'chatgpt', label: 'weekly' }),
          entry({ id: 'unlabeled', adapter: 'chatgpt' }),
        ],
        { label: 'Pre-update backup' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['keep']);
  });

  it('ANDs --adapter with --label', () => {
    expect(
      applyListFilters(
        [
          entry({ id: 'keep', adapter: 'chatgpt', label: 'pre-update' }),
          entry({ id: 'other-adapter', adapter: 'claude-code', label: 'pre-update' }),
          entry({ id: 'skip', adapter: 'chatgpt', label: 'weekly' }),
        ],
        { adapter: 'chatgpt', label: 'pre-update' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['keep']);
  });
});
