import { describe, expect, it } from 'vitest';
import {
  parseInitLimit,
  parseInitOffset,
  selectInitEntries,
  validateInitOutputOptions,
} from '../init.js';

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

  it('parses a bounded non-negative offset', () => {
    expect(parseInitOffset(undefined)).toBeUndefined();
    expect(parseInitOffset('0')).toBe(0);
    expect(parseInitOffset('1000')).toBe(1000);
    expect(() => parseInitOffset('-1')).toThrow(
      'Invalid --offset value "-1". Expected a non-negative integer up to 1000.',
    );
    expect(() => parseInitOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips rows before applying the limit', () => {
    expect(
      selectInitEntries([{ id: 'status' }, { id: 'config' }, { id: 'adapter' }], 1, 1),
    ).toEqual([{ id: 'config' }]);
  });

  it('rejects pagination flags for the single-object JSON summary', () => {
    expect(() => validateInitOutputOptions(true, 1)).toThrow(
      'The --limit and --offset options cannot be used with --json.',
    );
    expect(() => validateInitOutputOptions(true, undefined, 1)).toThrow(
      'The --limit and --offset options cannot be used with --json.',
    );
    expect(() => validateInitOutputOptions(true)).not.toThrow();
    expect(() => validateInitOutputOptions(false, 1, 1)).not.toThrow();
  });
});
