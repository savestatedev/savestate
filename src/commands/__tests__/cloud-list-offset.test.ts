import { describe, expect, it } from 'vitest';
import { parseCloudListOffset, selectCloudListPage } from '../cloud.js';

describe('savestate cloud list --offset', () => {
  it('defaults to undefined', () => {
    expect(parseCloudListOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseCloudListOffset('0')).toBe(0);
    expect(parseCloudListOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseCloudListOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseCloudListOffset('1000')).toBe(1000);
    expect(() => parseCloudListOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N snapshots before applying --limit', () => {
    expect(
      selectCloudListPage(
        [{ id: 'newest' }, { id: 'middle' }, { id: 'oldest' }],
        1,
        1,
      ).map((snapshot) => snapshot.id),
    ).toEqual(['middle']);
  });

  it('returns all snapshots when pagination is omitted', () => {
    const snapshots = [{ id: 'newest' }, { id: 'oldest' }];
    expect(selectCloudListPage(snapshots)).toEqual(snapshots);
  });
});
