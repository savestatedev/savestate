import { describe, expect, it } from 'vitest';
import { parseMemoryListSince } from '../memory-cli.js';
import { parseMemoryListLimit, parseMemoryListOffset } from '../memory.js';

describe('savestate memory list --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryListLimit(undefined)).toBeUndefined();
  });

  it('accepts positive decimal integers', () => {
    expect(parseMemoryListLimit('12')).toBe(12);
    expect(parseMemoryListLimit('1000')).toBe(1000);
  });

  it('accepts surrounding whitespace', () => {
    expect(parseMemoryListLimit(' 12 ')).toBe(12);
  });

  it.each(['0', '-1', '1.5', '0x10', '1e2', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryListLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });
});

describe('savestate memory list --offset', () => {
  it('accepts surrounding whitespace', () => {
    expect(parseMemoryListOffset(' 12 ')).toBe(12);
  });
});

describe('savestate memory list --since', () => {
  it('accepts date-only and timestamp values', () => {
    expect(parseMemoryListSince(' 2026-10-01 ')).toBe('2026-10-01');
    expect(parseMemoryListSince('2026-10-01T12:00:00Z')).toBe('2026-10-01T12:00:00Z');
    expect(parseMemoryListSince(undefined)).toBeUndefined();
  });

  it.each(['   ', 'not-a-date'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryListSince(value)).toThrow(
      `Invalid --since value "${value}". Expected an ISO-8601 date or timestamp.`,
    );
  });
});
