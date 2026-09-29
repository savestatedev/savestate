import { describe, expect, it } from 'vitest';
import { parseCloudDeleteLimit, selectCloudDeleteSnapshots } from '../cloud.js';

describe('savestate cloud delete --limit', () => {
  it('defaults to undefined', () => {
    expect(parseCloudDeleteLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseCloudDeleteLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseCloudDeleteLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseCloudDeleteLimit('1000')).toBe(1000);
    expect(() => parseCloudDeleteLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N cloud snapshots', () => {
    expect(
      selectCloudDeleteSnapshots(
        [{ id: 'old' }, { id: 'mid' }, { id: 'new' }],
        2,
      ).map((snapshot) => snapshot.id),
    ).toEqual(['old', 'mid']);
  });

  it('returns all snapshots when --limit is omitted', () => {
    const snapshots = [{ id: 'old' }, { id: 'new' }];
    expect(selectCloudDeleteSnapshots(snapshots, undefined)).toEqual(snapshots);
  });
});
