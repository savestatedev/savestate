import { describe, expect, it } from 'vitest';
import { parseSavestateStatusOffset, selectSavestateStatusOffsetEntries } from '../savestate-status-offset.js';

describe('MCP savestate_status offset', () => {
  it('defaults to undefined', () => {
    expect(parseSavestateStatusOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseSavestateStatusOffset(0)).toBe(0);
    expect(parseSavestateStatusOffset(12)).toBe(12);
  });

  it.each([-1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseSavestateStatusOffset(value)).toThrow(
      `Invalid offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseSavestateStatusOffset(1000)).toBe(1000);
    expect(() => parseSavestateStatusOffset(1001)).toThrow(
      'Invalid offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N status field rows', () => {
    expect(
      selectSavestateStatusOffsetEntries(
        [{ key: 'storage' }, { key: 'adapter' }, { key: 'memory' }],
        1,
      ).map((entry) => entry.key),
    ).toEqual(['adapter', 'memory']);
  });

  it('returns all rows when offset is omitted', () => {
    const entries = [{ key: 'storage' }, { key: 'adapter' }];
    expect(selectSavestateStatusOffsetEntries(entries, undefined)).toEqual(entries);
  });
});
