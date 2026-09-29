import { describe, expect, it } from 'vitest';
import { parseMemoryPromoteLimit, selectMemoryPromoteEntries } from '../memory.js';

describe('savestate memory promote --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryPromoteLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMemoryPromoteLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryPromoteLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMemoryPromoteLimit('1000')).toBe(1000);
    expect(() => parseMemoryPromoteLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectMemoryPromoteEntries(
        [{ id: 'status' }, { id: 'from' }, { id: 'to' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['status', 'from']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'from' }];
    expect(selectMemoryPromoteEntries(entries, undefined)).toEqual(entries);
  });
});
