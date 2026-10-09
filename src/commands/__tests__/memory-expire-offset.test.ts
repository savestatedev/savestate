import { describe, expect, it } from 'vitest';
import {
  applyMemoryExpireFilters,
  parseMemoryExpireOffset,
  selectMemoryExpireOffsetEntries,
} from '../memory-lifecycle.js';

describe('savestate memory expire --offset', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryExpireOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseMemoryExpireOffset('0')).toBe(0);
    expect(parseMemoryExpireOffset('12')).toBe(12);
  });

  it('accepts surrounding whitespace', () => {
    expect(parseMemoryExpireOffset(' 12 ')).toBe(12);
  });

  it.each(['-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryExpireOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseMemoryExpireOffset('1000')).toBe(1000);
    expect(() => parseMemoryExpireOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N expirable memories', () => {
    expect(
      selectMemoryExpireOffsetEntries(
        [{ id: 'mem-1' }, { id: 'mem-2' }, { id: 'mem-3' }],
        1,
      ).map((memory) => memory.id),
    ).toEqual(['mem-2', 'mem-3']);
  });

  it('returns all memories when offset is omitted', () => {
    const memories = [{ id: 'mem-1' }, { id: 'mem-2' }];
    expect(selectMemoryExpireOffsetEntries(memories, undefined)).toEqual(memories);
  });

  it('skips expirable memories before --limit', () => {
    expect(
      applyMemoryExpireFilters(
        [{ id: 'mem-1' }, { id: 'mem-2' }, { id: 'mem-3' }],
        { offset: '1', limit: '1' },
      ).map((memory) => memory.id),
    ).toEqual(['mem-2']);
  });
});
