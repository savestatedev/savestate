import { describe, expect, it } from 'vitest';
import {
  applyMemoryExplainFilters,
  parseMemoryExplainOffset,
  selectMemoryExplainOffsetEntries,
} from '../memory.js';

describe('savestate memory explain --offset', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryExplainOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseMemoryExplainOffset('0')).toBe(0);
    expect(parseMemoryExplainOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryExplainOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseMemoryExplainOffset('1000')).toBe(1000);
    expect(() => parseMemoryExplainOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N retrieval results', () => {
    expect(
      selectMemoryExplainOffsetEntries(
        [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
        1,
      ).map((entry) => entry.id),
    ).toEqual(['m2', 'm3']);
  });

  it('returns all results when offset is omitted', () => {
    const entries = [{ id: 'm1' }, { id: 'm2' }];
    expect(selectMemoryExplainOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips retrieval results before --limit', () => {
    expect(
      applyMemoryExplainFilters(
        [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['m2']);
  });
});
