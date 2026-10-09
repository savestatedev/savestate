import { describe, expect, it } from 'vitest';
import { parseMemoryExpireLimit, selectExpiredMemories } from '../memory-lifecycle.js';

describe('savestate memory expire --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryExpireLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMemoryExpireLimit('12')).toBe(12);
  });

  it('accepts surrounding whitespace', () => {
    expect(parseMemoryExpireLimit(' 12 ')).toBe(12);
  });

  it.each(['0', '-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryExpireLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMemoryExpireLimit('1000')).toBe(1000);
    expect(() => parseMemoryExpireLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N expirable memories', () => {
    expect(
      selectExpiredMemories(
        [{ id: 'mem-1' }, { id: 'mem-2' }, { id: 'mem-3' }],
        2,
      ).map((memory) => memory.id),
    ).toEqual(['mem-1', 'mem-2']);
  });

  it('returns all memories when --limit is omitted', () => {
    const memories = [{ id: 'mem-1' }, { id: 'mem-2' }];
    expect(selectExpiredMemories(memories, undefined)).toEqual(memories);
  });
});
