import { describe, expect, it } from 'vitest';
import {
  getSearchSnapshotsPreviousOffset,
  getSearchSnapshotsSuggestedOffset,
  parseSearchSnapshotsLimit,
  selectSearchSnapshotsEntries,
  selectSearchSnapshotsPage,
} from '../search-snapshots-limit.js';

describe('MCP savestate_search_snapshots limit', () => {
  it('defaults to undefined', () => {
    expect(parseSearchSnapshotsLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseSearchSnapshotsLimit(12)).toBe(12);
  });

  it.each([0, -1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSearchSnapshotsLimit(value)).toThrow(
      `Invalid limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSearchSnapshotsLimit(1000)).toBe(1000);
    expect(() => parseSearchSnapshotsLimit(1001)).toThrow(
      'Invalid limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N matches', () => {
    expect(
      selectSearchSnapshotsEntries(
        [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['s1', 's2']);
  });

  it('returns all matches when limit is omitted', () => {
    const entries = [{ id: 's1' }, { id: 's2' }];
    expect(selectSearchSnapshotsEntries(entries, undefined)).toEqual(entries);
  });

  it('reports when a bounded page has more matches', () => {
    expect(selectSearchSnapshotsPage(
      [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
      2,
    )).toEqual({
      entries: [{ id: 's1' }, { id: 's2' }],
      hasNextPage: true,
    });
  });

  it('does not report a next page at the exact boundary', () => {
    expect(selectSearchSnapshotsPage([{ id: 's1' }, { id: 's2' }], 2)).toEqual({
      entries: [{ id: 's1' }, { id: 's2' }],
      hasNextPage: false,
    });
  });

  it('returns the previous page offset for later pages', () => {
    expect(getSearchSnapshotsPreviousOffset(20, 20)).toBe(0);
    expect(getSearchSnapshotsPreviousOffset(5, 20)).toBe(0);
  });

  it('omits a previous page offset on the first page', () => {
    expect(getSearchSnapshotsPreviousOffset(0, 20)).toBeUndefined();
  });

  it('suggests the last populated page for an empty request', () => {
    expect(getSearchSnapshotsSuggestedOffset(3, 20)).toBe(0);
    expect(getSearchSnapshotsSuggestedOffset(41, 20)).toBe(40);
    expect(getSearchSnapshotsSuggestedOffset(0, 20)).toBeUndefined();
  });
});
