import { describe, expect, it } from 'vitest';
import { parseCloudOffset, resolveCloudPushSnapshots, selectCloudOffsetEntries } from '../cloud.js';

describe('savestate cloud --offset', () => {
  it('defaults to undefined', () => {
    expect(parseCloudOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseCloudOffset('0')).toBe(0);
    expect(parseCloudOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseCloudOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseCloudOffset('1000')).toBe(1000);
    expect(() => parseCloudOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N snapshots', () => {
    expect(
      selectCloudOffsetEntries(
        [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        1,
      ).map((snapshot) => snapshot.id),
    ).toEqual(['s2', 's3']);
  });

  it('returns all snapshots when offset is omitted', () => {
    const entries = [{ id: 's1' }, { id: 's2' }];
    expect(selectCloudOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips the newest snapshots before --limit', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['mid']);
  });
});
