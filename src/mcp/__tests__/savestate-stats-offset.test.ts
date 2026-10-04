import { describe, expect, it } from 'vitest';
import { parseSavestateStatsOffset, selectSavestateStatsOffsetEntries } from '../savestate-stats-offset.js';

describe('MCP savestate_stats offset', () => {
  it('defaults to undefined', () => {
    expect(parseSavestateStatsOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseSavestateStatsOffset(0)).toBe(0);
    expect(parseSavestateStatsOffset(12)).toBe(12);
  });

  it.each([-1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSavestateStatsOffset(value)).toThrow(
      `Invalid offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseSavestateStatsOffset(1000)).toBe(1000);
    expect(() => parseSavestateStatsOffset(1001)).toThrow(
      'Invalid offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N snapshots', () => {
    expect(
      selectSavestateStatsOffsetEntries(
        [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['s2', 's3']);
  });

  it('returns all snapshots when offset is omitted', () => {
    const entries = [{ id: 's1' }, { id: 's2' }];
    expect(selectSavestateStatsOffsetEntries(entries, undefined)).toEqual(entries);
  });
});
