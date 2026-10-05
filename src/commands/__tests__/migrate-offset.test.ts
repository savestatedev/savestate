import { describe, expect, it } from 'vitest';
import { parseMigrateOffset, resolveMigrateSnapshot, selectMigrateOffsetEntries } from '../migrate.js';

describe('savestate migrate --offset', () => {
  it('defaults to undefined', () => {
    expect(parseMigrateOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseMigrateOffset('0')).toBe(0);
    expect(parseMigrateOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMigrateOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseMigrateOffset('1000')).toBe(1000);
    expect(() => parseMigrateOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N snapshots', () => {
    expect(
      selectMigrateOffsetEntries(
        [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
        1,
      ).map((snapshot) => snapshot.id),
    ).toEqual(['s2', 's3']);
  });

  it('returns all snapshots when offset is omitted', () => {
    const entries = [{ id: 's1' }, { id: 's2' }];
    expect(selectMigrateOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips the newest snapshots before --limit', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-03-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-05-01T00:00:00Z' },
        ],
        { offset: '1', limit: '1' },
      ),
    ).toEqual('mid');
  });
});
