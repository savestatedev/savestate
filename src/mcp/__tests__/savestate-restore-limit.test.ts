import { describe, expect, it } from 'vitest';
import { parseSavestateRestoreLimit, selectSavestateRestoreEntries } from '../savestate-restore-limit.js';

describe('MCP savestate_restore limit', () => {
  it('defaults to undefined', () => {
    expect(parseSavestateRestoreLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseSavestateRestoreLimit(12)).toBe(12);
  });

  it.each([0, -1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSavestateRestoreLimit(value)).toThrow(
      `Invalid limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSavestateRestoreLimit(1000)).toBe(1000);
    expect(() => parseSavestateRestoreLimit(1001)).toThrow(
      'Invalid limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectSavestateRestoreEntries(
        [{ key: 'snapshot' }, { key: 'timestamp' }, { key: 'platform' }],
        2,
      ).map((entry) => entry.key),
    ).toEqual(['snapshot', 'timestamp']);
  });

  it('returns all rows when limit is omitted', () => {
    const entries = [{ key: 'snapshot' }, { key: 'timestamp' }];
    expect(selectSavestateRestoreEntries(entries, undefined)).toEqual(entries);
  });
});
