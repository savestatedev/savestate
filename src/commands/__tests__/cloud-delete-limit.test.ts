import { describe, expect, it } from 'vitest';
import {
  parseCloudDeleteLimit,
  parseCloudDeleteOffset,
  selectCloudDeletePage,
  selectCloudDeleteSnapshots,
} from '../cloud.js';

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

describe('savestate cloud delete --offset', () => {
  it('defaults to undefined', () => {
    expect(parseCloudDeleteOffset(undefined)).toBeUndefined();
  });

  it('accepts non-negative integers', () => {
    expect(parseCloudDeleteOffset('0')).toBe(0);
    expect(parseCloudDeleteOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope', ''])('rejects invalid value %s', (value) => {
    expect(() => parseCloudDeleteOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded offset', () => {
    expect(parseCloudDeleteOffset('1000')).toBe(1000);
    expect(() => parseCloudDeleteOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips matching snapshots before applying --limit', () => {
    expect(
      selectCloudDeletePage(
        [{ id: 'old' }, { id: 'mid' }, { id: 'new' }],
        1,
        1,
      ).map((snapshot) => snapshot.id),
    ).toEqual(['mid']);
  });
});
