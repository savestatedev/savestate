import { describe, expect, it } from 'vitest';
import {
  formatListMemoriesEmptyPage,
  formatListMemoriesPageSummary,
  parseListMemoriesLimit,
  selectListMemoriesEntries,
} from '../list-memories-limit.js';

describe('MCP list_memories limit', () => {
  it('defaults to undefined', () => {
    expect(parseListMemoriesLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseListMemoriesLimit(12)).toBe(12);
  });

  it.each([0, -1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseListMemoriesLimit(value)).toThrow(
      `Invalid limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseListMemoriesLimit(1000)).toBe(1000);
    expect(() => parseListMemoriesLimit(1001)).toThrow(
      'Invalid limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N memories', () => {
    expect(
      selectListMemoriesEntries(
        [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['m1', 'm2']);
  });

  it('returns all memories when limit is omitted', () => {
    const entries = [{ id: 'm1' }, { id: 'm2' }];
    expect(selectListMemoriesEntries(entries, undefined)).toEqual(entries);
  });

  it('summarizes page position and continuation state', () => {
    expect(formatListMemoriesPageSummary(2, 5, 2, true)).toBe(
      'Memories (2 shown of 5 total, page 2 of 3, starting at 2; previous offset 0; next offset 4; more available):',
    );
    expect(formatListMemoriesPageSummary(1, 1, undefined, false)).toBe(
      'Memories (1 shown of 1 total, page 1 of 1, starting at 0):',
    );
  });

  it('includes a previous offset for later pages using the requested page size', () => {
    expect(formatListMemoriesPageSummary(2, 8, 4, false, 2)).toBe(
      'Memories (2 shown of 8 total, page 3 of 4, starting at 4; previous offset 2):',
    );
  });

  it('reports the page position using the requested page size', () => {
    expect(formatListMemoriesPageSummary(2, 7, 2, true, 2)).toContain('page 2 of 4');
  });

  it('suggests the nearest populated page for an empty page', () => {
    expect(formatListMemoriesEmptyPage(5, 8, 2)).toBe(
      'No memories found at offset 8 (requested page 5; 3 pages available). ' +
      'Total matching: 5. ' +
      'Suggested offset 4 with limit 2 opens the nearest available page.',
    );
    expect(formatListMemoriesEmptyPage(0, undefined)).toBe(
      'No memories found at offset 0. Total matching: 0',
    );
  });

  it('explains active filters when an empty page is filtered', () => {
    expect(formatListMemoriesEmptyPage(0, undefined, undefined, {
      source: 'Claude-Code',
      tags: ['project', 'work'],
      minImportance: 0.8,
      search: 'encrypted archive',
    })).toBe(
      'No memories found at offset 0. Total matching: 0. ' +
      'Active filters: source=Claude-Code, tags=[project, work], search="encrypted archive", minImportance=0.8.',
    );
  });

  it('keeps filter context on an out-of-range page', () => {
    expect(formatListMemoriesEmptyPage(5, 8, 2, { type: 'event' })).toBe(
      'No memories found at offset 8. Total matching: 5. Active filters: type=event. ' +
      'Suggested offset 4 with limit 2 opens the nearest available page.',
    );
  });
});
