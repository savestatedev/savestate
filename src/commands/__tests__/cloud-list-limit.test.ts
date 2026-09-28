import { describe, expect, it } from 'vitest';
import { parseCloudListLimit, selectCloudListSnapshots } from '../cloud.js';

describe('savestate cloud list --limit', () => {
  it('defaults to undefined', () => {
    expect(parseCloudListLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseCloudListLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseCloudListLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseCloudListLimit('1000')).toBe(1000);
    expect(() => parseCloudListLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N cloud snapshots', () => {
    expect(
      selectCloudListSnapshots(
        [{ id: 'old' }, { id: 'mid' }, { id: 'new' }],
        2,
      ).map((snapshot) => snapshot.id),
    ).toEqual(['old', 'mid']);
  });

  it('returns all snapshots when --limit is omitted', () => {
    const snapshots = [{ id: 'old' }, { id: 'new' }];
    expect(selectCloudListSnapshots(snapshots, undefined)).toEqual(snapshots);
  });
});
