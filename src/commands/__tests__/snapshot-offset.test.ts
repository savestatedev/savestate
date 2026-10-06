import { describe, expect, it } from 'vitest';
import {
  applySnapshotFilters,
  parseSnapshotOffset,
  selectSnapshotOffsetEntries,
} from '../snapshot.js';

describe('savestate snapshot --offset', () => {
  it('defaults to undefined', () => {
    expect(parseSnapshotOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseSnapshotOffset('0')).toBe(0);
    expect(parseSnapshotOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseSnapshotOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseSnapshotOffset('1000')).toBe(1000);
    expect(() => parseSnapshotOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N status field rows', () => {
    expect(
      selectSnapshotOffsetEntries(
        [{ id: 'id' }, { id: 'adapter' }, { id: 'type' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['adapter', 'type']);
  });

  it('returns all rows when offset is omitted', () => {
    const entries = [{ id: 'id' }, { id: 'adapter' }];
    expect(selectSnapshotOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips rows before --limit', () => {
    expect(
      applySnapshotFilters(
        [{ id: 'id' }, { id: 'adapter' }, { id: 'type' }],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['adapter']);
  });
});
