import { describe, expect, it } from 'vitest';
import {
  parseMemoryEditLimit,
  resolveMemoryEditLimit,
  selectMemoryEditEntries,
} from '../memory-lifecycle.js';

describe('savestate memory edit --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryEditLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMemoryEditLimit('12')).toBe(12);
  });

  it('resolves --page-size as an alias for --limit', () => {
    expect(resolveMemoryEditLimit(undefined, '12')).toBe('12');
    expect(resolveMemoryEditLimit('12', undefined)).toBe('12');
  });

  it('rejects using both limit spellings', () => {
    expect(() => resolveMemoryEditLimit('10', '20')).toThrow(
      'Cannot use --limit with --page-size; choose one page-size option.',
    );
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
