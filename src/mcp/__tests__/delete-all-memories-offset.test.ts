import { describe, expect, it } from 'vitest';
import { parseDeleteAllMemoriesOffset, selectDeleteAllMemoriesOffsetEntries } from '../delete-all-memories-offset.js';

describe('MCP delete_all_memories offset', () => {
  it('defaults to undefined', () => {
    expect(parseDeleteAllMemoriesOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseDeleteAllMemoriesOffset(0)).toBe(0);
    expect(parseDeleteAllMemoriesOffset(12)).toBe(12);
  });

  it.each([-1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseDeleteAllMemoriesOffset(value)).toThrow(
      `Invalid offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseDeleteAllMemoriesOffset(1000)).toBe(1000);
    expect(() => parseDeleteAllMemoriesOffset(1001)).toThrow(
      'Invalid offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N memories', () => {
    expect(
      selectDeleteAllMemoriesOffsetEntries(
        [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['m2', 'm3']);
  });

  it('returns all memories when offset is omitted', () => {
    const entries = [{ id: 'm1' }, { id: 'm2' }];
    expect(selectDeleteAllMemoriesOffsetEntries(entries, undefined)).toEqual(entries);
  });
});
