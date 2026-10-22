import { describe, expect, it } from 'vitest';
import {
  buildMemoriesResourcePage,
  parseMemoriesResourceLimit,
  selectMemoriesResourceEntries,
} from '../memories-resource-limit.js';

describe('MCP savestate://memories limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoriesResourceLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMemoriesResourceLimit(12)).toBe(12);
  });

  it.each([0, -1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseMemoriesResourceLimit(value)).toThrow(
      `Invalid limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMemoriesResourceLimit(1000)).toBe(1000);
    expect(() => parseMemoriesResourceLimit(1001)).toThrow(
      'Invalid limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N memories', () => {
    expect(
      selectMemoriesResourceEntries(
        [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['m1', 'm2']);
  });

  it('returns all memories when limit is omitted', () => {
    const entries = [{ id: 'm1' }, { id: 'm2' }];
    expect(selectMemoriesResourceEntries(entries, undefined)).toEqual(entries);
  });

  it('reports total and the next offset for a partial page', () => {
    const page = buildMemoriesResourcePage(
      [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }],
      4,
      1,
      2,
    );

    expect(page).toEqual({
      count: 2,
      total: 4,
      offset: 1,
      nextOffset: 3,
      nextUri: 'savestate://memories?offset=3&limit=2',
      previousOffset: 0,
      suggestedOffset: null,
      entries: [{ id: 'm2' }, { id: 'm3' }],
    });
  });

  it('uses a null next offset on the final page', () => {
    expect(buildMemoriesResourcePage([{ id: 'm1' }, { id: 'm2' }], 2, 1, 2)).toMatchObject({
      count: 1,
      total: 2,
      offset: 1,
      nextOffset: null,
      nextUri: null,
      previousOffset: 0,
      suggestedOffset: null,
    });
  });

  it('suggests the last available page when an offset is stale', () => {
    expect(buildMemoriesResourcePage(
      [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
      3,
      9,
      2,
    )).toMatchObject({
      count: 0,
      offset: 9,
      previousOffset: 7,
      suggestedOffset: 2,
      nextOffset: null,
      nextUri: null,
    });
  });
});
