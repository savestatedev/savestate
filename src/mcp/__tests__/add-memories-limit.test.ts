import { describe, expect, it } from 'vitest';
import { parseAddMemoriesLimit, selectAddMemoriesEntries } from '../add-memories-limit.js';

describe('MCP add_memories limit', () => {
  it('defaults to undefined', () => {
    expect(parseAddMemoriesLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseAddMemoriesLimit(12)).toBe(12);
  });

  it.each([0, -1, 1.5])('rejects invalid value %s', (value) => {
    expect(() => parseAddMemoriesLimit(value)).toThrow(
      `Invalid limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseAddMemoriesLimit(1000)).toBe(1000);
    expect(() => parseAddMemoriesLimit(1001)).toThrow(
      'Invalid limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N memories', () => {
    expect(
      selectAddMemoriesEntries(
        [{ content: 'm1' }, { content: 'm2' }, { content: 'm3' }],
        2,
      ).map((entry) => entry.content),
    ).toEqual(['m1', 'm2']);
  });

  it('returns all memories when limit is omitted', () => {
    const entries = [{ content: 'm1' }, { content: 'm2' }];
    expect(selectAddMemoriesEntries(entries, undefined)).toEqual(entries);
  });
});
