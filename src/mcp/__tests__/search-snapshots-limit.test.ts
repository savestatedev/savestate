import { describe, expect, it } from 'vitest';
import { parseSearchSnapshotsLimit, selectSearchSnapshotsEntries } from '../search-snapshots-limit.js';

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
});
