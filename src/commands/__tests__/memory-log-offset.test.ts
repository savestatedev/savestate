import { describe, expect, it } from 'vitest';
import {
  applyMemoryLogFilters,
  parseMemoryLogOffset,
  selectMemoryLogOffsetEntries,
} from '../memory-lifecycle.js';

describe('savestate memory log --offset', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryLogOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseMemoryLogOffset('0')).toBe(0);
    expect(parseMemoryLogOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryLogOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseMemoryLogOffset('1000')).toBe(1000);
    expect(() => parseMemoryLogOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N audit events', () => {
    expect(
      selectMemoryLogOffsetEntries(
        [{ action: 'created' }, { action: 'edited' }, { action: 'deleted' }],
        1,
      ).map((entry) => entry.action),
    ).toEqual(['edited', 'deleted']);
  });

  it('returns all events when offset is omitted', () => {
    const entries = [{ action: 'created' }, { action: 'edited' }];
    expect(selectMemoryLogOffsetEntries(entries, undefined)).toEqual(entries);
  });

  it('skips audit events before --limit', () => {
    expect(
      applyMemoryLogFilters(
        [{ action: 'created' }, { action: 'edited' }, { action: 'deleted' }],
        { offset: '1', limit: '1' },
      ).map((entry) => entry.action),
    ).toEqual(['edited']);
  });
});
