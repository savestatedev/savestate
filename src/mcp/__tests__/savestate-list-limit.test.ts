import { describe, expect, it } from 'vitest';
import {
  formatSavestateListEmptyPage,
  formatSavestateListPageSummary,
  parseSavestateListLimit,
  selectSavestateListEntries,
} from '../savestate-list-limit.js';

describe('MCP savestate_list limit', () => {
  it('defaults to undefined', () => {
    expect(parseSavestateListLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseSavestateListLimit(12)).toBe(12);
  });

  it.each([0, -1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSavestateListLimit(value)).toThrow(
      `Invalid limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSavestateListLimit(1000)).toBe(1000);
    expect(() => parseSavestateListLimit(1001)).toThrow(
      'Invalid limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N snapshots', () => {
    expect(
      selectSavestateListEntries(
        [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['s1', 's2']);
  });

  it('returns all snapshots when limit is omitted', () => {
    const entries = [{ id: 's1' }, { id: 's2' }];
    expect(selectSavestateListEntries(entries, undefined)).toEqual(entries);
  });

  it('summarizes page position and continuation state', () => {
    expect(formatSavestateListPageSummary(2, 5, 2, true)).toBe(
      'Snapshots (2 shown of 5 total, starting at 2; next offset 4; more available):',
    );
    expect(formatSavestateListPageSummary(1, 1, undefined, false)).toBe(
      'Snapshots (1 shown of 1 total, starting at 0):',
    );
  });

  it('keeps the requested offset visible for an empty page', () => {
    expect(formatSavestateListEmptyPage(5, 8)).toBe(
      'No snapshots found at offset 8. Total stored: 5. Suggested offset 0 with limit 10 opens the nearest available page.',
    );
    expect(formatSavestateListEmptyPage(25, 30, 10)).toBe(
      'No snapshots found at offset 30. Total stored: 25. Suggested offset 20 with limit 10 opens the nearest available page.',
    );
    expect(formatSavestateListEmptyPage(0, undefined)).toBe(
      'No snapshots found at offset 0. Total stored: 0',
    );
  });
});
