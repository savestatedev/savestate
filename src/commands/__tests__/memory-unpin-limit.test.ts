import { describe, expect, it } from 'vitest';
import { parseMemoryUnpinLimit, selectMemoryUnpinEntries } from '../memory.js';

describe('savestate memory unpin --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryUnpinLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMemoryUnpinLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryUnpinLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMemoryUnpinLimit('1000')).toBe(1000);
    expect(() => parseMemoryUnpinLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectMemoryUnpinEntries(
        [{ id: 'status' }, { id: 'pinned' }, { id: 'id' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['status', 'pinned']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'pinned' }];
    expect(selectMemoryUnpinEntries(entries, undefined)).toEqual(entries);
  });
});
