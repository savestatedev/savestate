import { describe, expect, it } from 'vitest';
import { parseSavestateListOffset, selectSavestateListOffsetEntries } from '../savestate-list-offset.js';

describe('MCP savestate_list offset', () => {
  it('defaults to undefined', () => {
    expect(parseSavestateListOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseSavestateListOffset(0)).toBe(0);
    expect(parseSavestateListOffset(12)).toBe(12);
  });

  it.each([-1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSavestateListOffset(value)).toThrow(
      `Invalid offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseSavestateListOffset(1000)).toBe(1000);
    expect(() => parseSavestateListOffset(1001)).toThrow(
      'Invalid offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N snapshots', () => {
    expect(
      selectSavestateListOffsetEntries(
        [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['s2', 's3']);
  });

  it('returns all snapshots when offset is omitted', () => {
    const entries = [{ id: 's1' }, { id: 's2' }];
    expect(selectSavestateListOffsetEntries(entries, undefined)).toEqual(entries);
  });
});
