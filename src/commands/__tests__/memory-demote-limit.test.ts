import { describe, expect, it } from 'vitest';
import { parseMemoryDemoteLimit, selectMemoryDemoteEntries } from '../memory.js';

describe('savestate memory demote --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryDemoteLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMemoryDemoteLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryDemoteLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMemoryDemoteLimit('1000')).toBe(1000);
    expect(() => parseMemoryDemoteLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectMemoryDemoteEntries(
        [{ id: 'status' }, { id: 'from' }, { id: 'to' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['status', 'from']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'from' }];
    expect(selectMemoryDemoteEntries(entries, undefined)).toEqual(entries);
  });
});
