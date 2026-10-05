import { describe, expect, it } from 'vitest';
import { parseSavestateRestoreOffset, selectSavestateRestoreOffsetEntries } from '../savestate-restore-offset.js';

describe('MCP savestate_restore offset', () => {
  it('defaults to undefined', () => {
    expect(parseSavestateRestoreOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseSavestateRestoreOffset(0)).toBe(0);
    expect(parseSavestateRestoreOffset(12)).toBe(12);
  });

  it.each([-1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSavestateRestoreOffset(value)).toThrow(
      `Invalid offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseSavestateRestoreOffset(1000)).toBe(1000);
    expect(() => parseSavestateRestoreOffset(1001)).toThrow(
      'Invalid offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N status field rows', () => {
    expect(
      selectSavestateRestoreOffsetEntries(
        [{ key: 'snapshot' }, { key: 'timestamp' }, { key: 'platform' }],
        1,
      ).map((entry) => entry.key),
    ).toEqual(['timestamp', 'platform']);
  });

  it('returns all rows when offset is omitted', () => {
    const entries = [{ key: 'snapshot' }, { key: 'timestamp' }];
    expect(selectSavestateRestoreOffsetEntries(entries, undefined)).toEqual(entries);
  });
});
