import { describe, expect, it } from 'vitest';
import { parseMemoryEditLimit, selectMemoryEditEntries } from '../memory-lifecycle.js';

describe('savestate memory edit --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryEditLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMemoryEditLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryEditLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMemoryEditLimit('1000')).toBe(1000);
    expect(() => parseMemoryEditLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectMemoryEditEntries(
        [{ id: 'status' }, { id: 'id' }, { id: 'version' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['status', 'id']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'id' }];
    expect(selectMemoryEditEntries(entries, undefined)).toEqual(entries);
  });
});
