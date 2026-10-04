import { describe, expect, it } from 'vitest';
import { parseSearchSnapshotsOffset, selectSearchSnapshotsOffsetEntries } from '../search-snapshots-offset.js';

describe('MCP savestate_search_snapshots offset', () => {
  it('defaults to undefined', () => {
    expect(parseSearchSnapshotsOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseSearchSnapshotsOffset(0)).toBe(0);
    expect(parseSearchSnapshotsOffset(12)).toBe(12);
  });

  it.each([-1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSearchSnapshotsOffset(value)).toThrow(
      `Invalid offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseSearchSnapshotsOffset(1000)).toBe(1000);
    expect(() => parseSearchSnapshotsOffset(1001)).toThrow(
      'Invalid offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N matches', () => {
    expect(
      selectSearchSnapshotsOffsetEntries(
        [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['s2', 's3']);
  });

  it('returns all matches when offset is omitted', () => {
    const entries = [{ id: 's1' }, { id: 's2' }];
    expect(selectSearchSnapshotsOffsetEntries(entries, undefined)).toEqual(entries);
  });
});
