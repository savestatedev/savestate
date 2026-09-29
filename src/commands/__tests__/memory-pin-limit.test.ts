import { describe, expect, it } from 'vitest';
import { parseMemoryPinLimit, selectMemoryPinEntries } from '../memory.js';

describe('savestate memory pin --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryPinLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMemoryPinLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryPinLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMemoryPinLimit('1000')).toBe(1000);
    expect(() => parseMemoryPinLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectMemoryPinEntries(
        [{ id: 'status' }, { id: 'pinned' }, { id: 'id' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['status', 'pinned']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'pinned' }];
    expect(selectMemoryPinEntries(entries, undefined)).toEqual(entries);
  });
});
