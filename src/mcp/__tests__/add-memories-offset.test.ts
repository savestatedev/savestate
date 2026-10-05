import { describe, expect, it } from 'vitest';
import { parseAddMemoriesOffset, selectAddMemoriesOffsetEntries } from '../add-memories-offset.js';

describe('MCP add_memories offset', () => {
  it('defaults to undefined', () => {
    expect(parseAddMemoriesOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseAddMemoriesOffset(0)).toBe(0);
    expect(parseAddMemoriesOffset(12)).toBe(12);
  });

  it.each([-1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseAddMemoriesOffset(value)).toThrow(
      `Invalid offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseAddMemoriesOffset(1000)).toBe(1000);
    expect(() => parseAddMemoriesOffset(1001)).toThrow(
      'Invalid offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N memories', () => {
    expect(
      selectAddMemoriesOffsetEntries(
        [{ content: 'm1' }, { content: 'm2' }, { content: 'm3' }],
        1,
      ).map((entry) => entry.content),
    ).toEqual(['m2', 'm3']);
  });

  it('returns all memories when offset is omitted', () => {
    const entries = [{ content: 'm1' }, { content: 'm2' }];
    expect(selectAddMemoriesOffsetEntries(entries, undefined)).toEqual(entries);
  });
});
