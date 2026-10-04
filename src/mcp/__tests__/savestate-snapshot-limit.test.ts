import { describe, expect, it } from 'vitest';
import { parseSavestateSnapshotLimit, selectSavestateSnapshotEntries } from '../savestate-snapshot-limit.js';

describe('MCP savestate_snapshot limit', () => {
  it('defaults to undefined', () => {
    expect(parseSavestateSnapshotLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseSavestateSnapshotLimit(12)).toBe(12);
  });

  it.each([0, -1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSavestateSnapshotLimit(value)).toThrow(
      `Invalid limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSavestateSnapshotLimit(1000)).toBe(1000);
    expect(() => parseSavestateSnapshotLimit(1001)).toThrow(
      'Invalid limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectSavestateSnapshotEntries(
        [{ key: 'id' }, { key: 'adapter' }, { key: 'type' }],
        2,
      ).map((entry) => entry.key),
    ).toEqual(['id', 'adapter']);
  });

  it('returns all rows when limit is omitted', () => {
    const entries = [{ key: 'id' }, { key: 'adapter' }];
    expect(selectSavestateSnapshotEntries(entries, undefined)).toEqual(entries);
  });
});
