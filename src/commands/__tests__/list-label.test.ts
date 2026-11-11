import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import {
  applyListFilters,
  formatListLabelCell,
  getListLabelWidth,
  normalizeListLabel,
  parseListLabel,
  formatListPageSummary,
} from '../list.js';

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

  it('matches labels from legacy indexes with surrounding whitespace', () => {
    expect(
      applyListFilters(
        [entry({ id: 'legacy', adapter: 'chatgpt', label: ' Pre-update backup ' })],
        { label: 'Pre-update backup' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['legacy']);
  });

  it('normalizes legacy whitespace for list output', () => {
    expect(normalizeListLabel('  Pre-update backup  ')).toBe('Pre-update backup');
    expect(normalizeListLabel('   ')).toBeNull();
    expect(formatListLabelCell('  backup  ', 10)).toBe('backup    ');
  });

  it('sizes the label column from normalized labels', () => {
    expect(getListLabelWidth([entry({ id: 'legacy', adapter: 'chatgpt', label: '  backup  ' })])).toBe(6);
  });

  it('canonicalizes label casing in JSON filter metadata', async () => {
    const { formatListJson } = await import('../list.js');
    const result = JSON.parse(formatListJson([], 50, 0, false, { label: '  Nightly Backup  ' }));
    expect(result.filters.label).toBe('nightly backup');
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

  it('suggests the nearest page when an offset skips past every snapshot', () => {
    expect(formatListPageSummary(5, 0, 8, 2)).toBe(
      '(no snapshots shown: offset 8 skips past 5 after filters; ' +
      'try --offset 4 to open the nearest available page)',
    );
  });
});
