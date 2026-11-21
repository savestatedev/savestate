import { describe, expect, it } from 'vitest';
import {
  parseMemoryLogLimit,
  parseMemoryLogPage,
  resolveMemoryLogOffset,
  resolveMemoryLogLimit,
  resolveMemoryLogPageLimit,
  selectMemoryLogEntries,
} from '../memory-lifecycle.js';

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

  it('supports --page-size as an alias', () => {
    expect(resolveMemoryLogLimit(undefined, '7')).toBe(7);
    expect(() => resolveMemoryLogLimit('5', '7')).toThrow(
      'Cannot use --limit with --page-size; choose one page-size option.',
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

  it('resolves a 1-based page into an offset', () => {
    expect(resolveMemoryLogOffset(undefined, '2', 5)).toBe(5);
    expect(() => resolveMemoryLogOffset('5', '2', 5)).toThrow(
      'Cannot use --page with --offset; choose one pagination mode.',
    );
  });

  it('uses the default page size when --page is supplied alone', () => {
    expect(parseMemoryLogPage(' 3 ')).toBe(3);
    expect(resolveMemoryLogPageLimit(undefined, undefined, '2')).toBe(20);
    expect(resolveMemoryLogOffset(undefined, '2', 20)).toBe(20);
    expect(() => resolveMemoryLogOffset(undefined, '202', 5)).toThrow(
      'The requested page exceeds the maximum supported offset of 1000.',
    );
  });
});
