import { describe, expect, it } from 'vitest';
import {
  parseContextConfigLimit,
  parseContextConfigOffset,
  selectContextConfigEntries,
} from '../context.js';

describe('savestate context config --limit', () => {
  it('defaults to undefined', () => {
    expect(parseContextConfigLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseContextConfigLimit('12')).toBe(12);
  });

  it('accepts surrounding whitespace', () => {
    expect(parseContextConfigLimit(' 12 ')).toBe(12);
  });

  it.each(['0', '-1', '1.5', '1e2', '+2', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseContextConfigLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseContextConfigLimit('1000')).toBe(1000);
    expect(() => parseContextConfigLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N scoring weight or budget allocation rows', () => {
    expect(
      selectContextConfigEntries(
        [{ id: 'relevance' }, { id: 'recency' }, { id: 'importance' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['relevance', 'recency']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'relevance' }, { id: 'recency' }];
    expect(selectContextConfigEntries(entries, undefined)).toEqual(entries);
  });

  it('pages rows with --offset before applying --limit', () => {
    expect(
      selectContextConfigEntries(
        [{ id: 'relevance' }, { id: 'recency' }, { id: 'importance' }],
        1,
        1,
      ).map((entry) => entry.id),
    ).toEqual(['recency']);
  });

  it('parses and bounds --offset', () => {
    expect(parseContextConfigOffset(undefined)).toBeUndefined();
    expect(parseContextConfigOffset(' 2 ')).toBe(2);
    expect(() => parseContextConfigOffset('-1')).toThrow(
      'Invalid --offset value "-1". Expected a non-negative integer up to 1000.',
    );
    expect(() => parseContextConfigOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });
});
