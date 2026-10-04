import { describe, expect, it } from 'vitest';
import { parseSavestateStatusLimit, selectSavestateStatusEntries } from '../savestate-status-limit.js';

describe('MCP savestate_status limit', () => {
  it('defaults to undefined', () => {
    expect(parseSavestateStatusLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseSavestateStatusLimit(12)).toBe(12);
  });

  it.each([0, -1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSavestateStatusLimit(value)).toThrow(
      `Invalid limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSavestateStatusLimit(1000)).toBe(1000);
    expect(() => parseSavestateStatusLimit(1001)).toThrow(
      'Invalid limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectSavestateStatusEntries(
        [{ key: 'storage' }, { key: 'adapter' }, { key: 'memory' }],
        2,
      ).map((entry) => entry.key),
    ).toEqual(['storage', 'adapter']);
  });

  it('returns all rows when limit is omitted', () => {
    const entries = [{ key: 'storage' }, { key: 'adapter' }];
    expect(selectSavestateStatusEntries(entries, undefined)).toEqual(entries);
  });
});
