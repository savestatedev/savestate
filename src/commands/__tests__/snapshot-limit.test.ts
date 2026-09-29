import { describe, expect, it } from 'vitest';
import { parseSnapshotLimit, selectSnapshotEntries } from '../snapshot.js';

describe('savestate snapshot --limit', () => {
  it('defaults to undefined', () => {
    expect(parseSnapshotLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseSnapshotLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseSnapshotLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSnapshotLimit('1000')).toBe(1000);
    expect(() => parseSnapshotLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectSnapshotEntries(
        [{ id: 'id' }, { id: 'adapter' }, { id: 'type' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['id', 'adapter']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'id' }, { id: 'adapter' }];
    expect(selectSnapshotEntries(entries, undefined)).toEqual(entries);
  });
});
