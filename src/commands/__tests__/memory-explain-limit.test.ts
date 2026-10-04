import { describe, expect, it } from 'vitest';
import { parseMemoryExplainLimit, selectMemoryExplainEntries } from '../memory.js';

describe('savestate memory explain --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryExplainLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMemoryExplainLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryExplainLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMemoryExplainLimit('1000')).toBe(1000);
    expect(() => parseMemoryExplainLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N retrieval results', () => {
    expect(
      selectMemoryExplainEntries(
        [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['m1', 'm2']);
  });

  it('defaults to 5 results when --limit is omitted', () => {
    const entries = Array.from({ length: 7 }, (_, index) => ({ id: `m${index + 1}` }));
    expect(selectMemoryExplainEntries(entries, undefined).map((entry) => entry.id)).toEqual(
      entries.slice(0, 5).map((entry) => entry.id),
    );
  });
});
