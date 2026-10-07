import { describe, expect, it } from 'vitest';
import { parseContextLimit, parseContextOffset, selectContextCandidates } from '../context.js';

describe('savestate context explain --limit', () => {
  it('defaults to undefined', () => {
    expect(parseContextLimit(undefined)).toBeUndefined();
    expect(parseContextOffset(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseContextLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseContextLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseContextLimit('1000')).toBe(1000);
    expect(() => parseContextLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('accepts a bounded non-negative offset', () => {
    expect(parseContextOffset('12')).toBe(12);
    expect(parseContextOffset('1000')).toBe(1000);
  });

  it.each(['-1', '1.5', 'nope', '1001'])('rejects invalid offset %s', (value) => {
    expect(() => parseContextOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('keeps the first N candidates', () => {
    expect(
      selectContextCandidates(
        [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
        2,
      ).map((candidate) => candidate.id),
    ).toEqual(['c1', 'c2']);
  });

  it('defaults to 10 candidates when --limit is omitted', () => {
    const candidates = Array.from({ length: 12 }, (_, index) => ({ id: `c${index + 1}` }));
    expect(selectContextCandidates(candidates, undefined).map((candidate) => candidate.id)).toEqual(
      candidates.slice(0, 10).map((candidate) => candidate.id),
    );
  });

  it('applies offset before limit', () => {
    const candidates = Array.from({ length: 5 }, (_, index) => ({ id: `c${index + 1}` }));
    expect(selectContextCandidates(candidates, 2, 2).map((candidate) => candidate.id)).toEqual([
      'c3',
      'c4',
    ]);
  });
});
