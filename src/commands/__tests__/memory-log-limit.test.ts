import { describe, expect, it } from 'vitest';
import { parseMemoryLogLimit, selectMemoryLogEntries } from '../memory-lifecycle.js';

describe('savestate memory log --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryLogLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMemoryLogLimit('12')).toBe(12);
  });

  it('accepts surrounding whitespace', () => {
    expect(parseMemoryLogLimit(' 12 ')).toBe(12);
    expect(parseMemoryLogLimit(' 1')).toBe(1);
  });

  it.each(['0', '-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryLogLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMemoryLogLimit('1000')).toBe(1000);
    expect(() => parseMemoryLogLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N audit events', () => {
    expect(
      selectMemoryLogEntries(
        [{ action: 'created' }, { action: 'edited' }, { action: 'deleted' }],
        2,
      ).map((entry) => entry.action),
    ).toEqual(['created', 'edited']);
  });

  it('returns all events when --limit is omitted', () => {
    const entries = [{ action: 'created' }, { action: 'edited' }];
    expect(selectMemoryLogEntries(entries, undefined)).toEqual(entries);
  });
});
