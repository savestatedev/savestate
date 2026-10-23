import { describe, expect, it } from 'vitest';
import {
  buildSnapshotsResourcePage,
  parseSnapshotsResourceLimit,
  selectSnapshotsResourceEntries,
} from '../snapshots-resource-limit.js';

describe('MCP savestate://snapshots limit', () => {
  it('defaults to undefined', () => {
    expect(parseSnapshotsResourceLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseSnapshotsResourceLimit(12)).toBe(12);
  });

  it.each([0, -1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSnapshotsResourceLimit(value)).toThrow(
      `Invalid limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSnapshotsResourceLimit(1000)).toBe(1000);
    expect(() => parseSnapshotsResourceLimit(1001)).toThrow(
      'Invalid limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N snapshots', () => {
    expect(
      selectSnapshotsResourceEntries(
        [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['s1', 's2']);
  });

  it('returns all snapshots when limit is omitted', () => {
    const entries = [{ id: 's1' }, { id: 's2' }];
    expect(selectSnapshotsResourceEntries(entries, undefined)).toEqual(entries);
  });

  it('reports total and the next offset for a partial page', () => {
    const page = buildSnapshotsResourcePage(
      [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }],
      1,
      2,
    );

    expect(page).toEqual({
      count: 2,
      total: 4,
      remaining: 1,
      offset: 1,
      pageSize: 2,
      nextOffset: 3,
      nextUri: 'savestate://snapshots?offset=3&limit=2',
      previousOffset: 0,
      previousUri: 'savestate://snapshots?offset=0&limit=2',
      suggestedOffset: null,
      suggestedUri: null,
      entries: [{ id: 's2' }, { id: 's3' }],
    });
  });

  it('uses a null next offset on the final page', () => {
    expect(buildSnapshotsResourcePage([{ id: 's1' }, { id: 's2' }], 1, 2)).toMatchObject({
      count: 1,
      total: 2,
      remaining: 0,
      offset: 1,
      pageSize: 2,
      nextOffset: null,
      nextUri: null,
      previousOffset: 0,
      previousUri: 'savestate://snapshots?offset=0&limit=2',
      suggestedOffset: null,
    });
  });

  it('suggests the nearest available page when the offset is stale', () => {
    expect(buildSnapshotsResourcePage([{ id: 's1' }, { id: 's2' }, { id: 's3' }], 9, 2)).toMatchObject({
      count: 0,
      remaining: 0,
      offset: 9,
      pageSize: 2,
      previousOffset: 2,
      previousUri: 'savestate://snapshots?offset=2&limit=2',
      suggestedOffset: 2,
      suggestedUri: 'savestate://snapshots?offset=2&limit=2',
    });
  });
});
