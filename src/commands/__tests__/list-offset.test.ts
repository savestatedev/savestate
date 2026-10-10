import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import {
  formatListPageSummary,
  formatListDate,
  parseListOffset,
  selectListOffsetEntries,
  sortListEntries,
  validateListDateRange,
} from '../list.js';

describe('savestate list --offset', () => {
  it('defaults to undefined', () => {
    expect(parseListOffset(undefined)).toBeUndefined();
  });

  it('accepts zero, positive integers, and surrounding whitespace', () => {
    expect(parseListOffset('0')).toBe(0);
    expect(parseListOffset(' 12 ')).toBe(12);
  });

  it('accepts surrounding whitespace from scripted callers', () => {
    expect(parseListOffset(' 12 ')).toBe(12);
  });

  it.each(['-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseListOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseListOffset('1000')).toBe(1000);
    expect(() => parseListOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N snapshots', () => {
    expect(
      selectListOffsetEntries(
        [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['s2', 's3']);
  });

  it('returns all snapshots when offset is omitted', () => {
    const entries = [{ id: 's1' }, { id: 's2' }];
    expect(selectListOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('reports the filtered total and offset for a human-readable page', () => {
    expect(formatListPageSummary(12, 2, 10, 2)).toBe(
      '(showing 2 of 12 after filters; offset 10, limit 2)',
    );
  });

  it('uses snapshot ids to break ties for identical timestamps', () => {
    const timestamp = '2026-10-08T12:00:00.000Z';
    expect(sortListEntries([
      { id: 'zeta', timestamp },
      { id: 'alpha', timestamp },
    ] as SnapshotIndexEntry[]).map((entry) => entry.id)).toEqual(['alpha', 'zeta']);
  });

  it('can sort snapshots oldest first', () => {
    expect(sortListEntries([
      { id: 'newer', timestamp: '2026-01-02T00:00:00.000Z' },
      { id: 'older', timestamp: '2026-01-01T00:00:00.000Z' },
    ] as SnapshotIndexEntry[], true).map((entry) => entry.id)).toEqual(['older', 'newer']);
  });

  it('keeps same-timestamp ties deterministic when sorting oldest first', () => {
    const timestamp = '2026-10-08T12:00:00.000Z';
    expect(sortListEntries([
      { id: 'zeta', timestamp },
      { id: 'alpha', timestamp },
    ] as SnapshotIndexEntry[], true).map((entry) => entry.id)).toEqual(['alpha', 'zeta']);
  });

  it('rejects an inverted date range before filtering', () => {
    expect(() => validateListDateRange('2026-10-10', '2026-10-09')).toThrow(
      'Invalid list date range: --since (2026-10-10) must be on or before --until (2026-10-09).',
    );
    expect(() => validateListDateRange('2026-10-09', '2026-10-10')).not.toThrow();
  });

  it('keeps human-readable dates distinct across years', () => {
    expect(formatListDate('2025-01-25T09:30:00.000Z')).toContain('2025');
    expect(formatListDate('2026-01-25T09:30:00.000Z')).toContain('2026');
  });
});
