import { describe, expect, it } from 'vitest';
import { parseSavestateListLimit, selectSavestateListEntries } from '../savestate-list-limit.js';

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
});
