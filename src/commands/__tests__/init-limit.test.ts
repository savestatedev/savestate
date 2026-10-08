import { describe, expect, it } from 'vitest';
import { parseInitLimit, selectInitEntries } from '../init.js';

describe('savestate init --limit', () => {
  it('defaults to undefined', () => {
    expect(parseInitLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseInitLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseInitLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseInitLimit('1000')).toBe(1000);
    expect(() => parseInitLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectInitEntries(
        [{ id: 'status' }, { id: 'config' }, { id: 'adapter' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['status', 'config']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'config' }];
    expect(selectInitEntries(entries, undefined)).toEqual(entries);
  });
});
