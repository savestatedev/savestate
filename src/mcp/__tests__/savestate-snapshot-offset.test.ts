import { describe, expect, it } from 'vitest';
import { parseSavestateSnapshotOffset, selectSavestateSnapshotOffsetEntries } from '../savestate-snapshot-offset.js';

describe('MCP savestate_snapshot offset', () => {
  it('defaults to undefined', () => {
    expect(parseSavestateSnapshotOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseSavestateSnapshotOffset(0)).toBe(0);
    expect(parseSavestateSnapshotOffset(12)).toBe(12);
  });

  it.each([-1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSavestateSnapshotOffset(value)).toThrow(
      `Invalid offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseSavestateSnapshotOffset(1000)).toBe(1000);
    expect(() => parseSavestateSnapshotOffset(1001)).toThrow(
      'Invalid offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N status field rows', () => {
    expect(
      selectSavestateSnapshotOffsetEntries(
        [{ key: 'id' }, { key: 'adapter' }, { key: 'type' }],
        1,
      ).map((entry) => entry.key),
    ).toEqual(['adapter', 'type']);
  });

  it('returns all rows when offset is omitted', () => {
    const entries = [{ key: 'id' }, { key: 'adapter' }];
    expect(selectSavestateSnapshotOffsetEntries(entries, undefined)).toEqual(entries);
  });
});
