import { describe, expect, it } from 'vitest';
import { parseSavestateStatsLimit, selectSavestateStatsEntries } from '../savestate-stats-limit.js';

describe('MCP savestate_stats limit', () => {
  it('defaults to undefined', () => {
    expect(parseSavestateStatsLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseSavestateStatsLimit(12)).toBe(12);
  });

  it.each([0, -1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSavestateStatsLimit(value)).toThrow(
      `Invalid limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSavestateStatsLimit(1000)).toBe(1000);
    expect(() => parseSavestateStatsLimit(1001)).toThrow(
      'Invalid limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N snapshots', () => {
    expect(
      selectSavestateStatsEntries(
        [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['s1', 's2']);
  });

  it('returns all snapshots when limit is omitted', () => {
    const entries = [{ id: 's1' }, { id: 's2' }];
    expect(selectSavestateStatsEntries(entries, undefined)).toEqual(entries);
  });
});
