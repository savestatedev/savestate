import { describe, expect, it } from 'vitest';
import { parseMemoryDeleteLimit, selectMemoryDeleteEntries } from '../memory-lifecycle.js';

describe('savestate memory delete --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryDeleteLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMemoryDeleteLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryDeleteLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMemoryDeleteLimit('1000')).toBe(1000);
    expect(() => parseMemoryDeleteLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectMemoryDeleteEntries(
        [{ id: 'status' }, { id: 'id' }, { id: 'reason' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['status', 'id']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'id' }];
    expect(selectMemoryDeleteEntries(entries, undefined)).toEqual(entries);
  });
});
