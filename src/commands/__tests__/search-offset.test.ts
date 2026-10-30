import { describe, expect, it } from 'vitest';
import { formatSearchPageHint, parseSearchOffset } from '../search.js';

describe('savestate search --offset', () => {
  it('defaults to undefined', () => {
    expect(parseSearchOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseSearchOffset('0')).toBe(0);
    expect(parseSearchOffset('12')).toBe(12);
  });

  it('accepts surrounding whitespace', () => {
    expect(parseSearchOffset(' 12 ')).toBe(12);
    expect(parseSearchOffset(' 1')).toBe(1);
  });

  it.each(['-1', '1.5', 'nope', ''])('rejects invalid value %s', (value) => {
    expect(() => parseSearchOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseSearchOffset('1000')).toBe(1000);
    expect(() => parseSearchOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('suggests the next page when the result page is full', () => {
    expect(formatSearchPageHint(5, 10, 5)).toBe(
      'More matches may be available; try --offset 15 --limit 5.',
    );
  });

  it('suggests the previous page when an offset has no results', () => {
    expect(formatSearchPageHint(0, 10, 5)).toBe(
      'No matches found at offset 10. Try --offset 5 --limit 5.',
    );
  });

  it('caps the next-page hint at the maximum offset', () => {
    expect(formatSearchPageHint(20, 995, 20)).toBe(
      'More matches may be available; try --offset 1000 --limit 20 (maximum).',
    );
  });

  it('marks an exact maximum next page as capped', () => {
    expect(formatSearchPageHint(20, 980, 20)).toBe(
      'More matches may be available; try --offset 1000 --limit 20 (maximum).',
    );
  });

  it('does not suggest an invalid page past the maximum offset', () => {
    expect(formatSearchPageHint(20, 1000, 20)).toBe(
      'Reached maximum searchable offset 1000; no later page is available.',
    );
  });

  it('does not add a hint for a partial first page', () => {
    expect(formatSearchPageHint(3, 0, 5)).toBeUndefined();
  });

  it('offers a previous page for a partial later page', () => {
    expect(formatSearchPageHint(3, 10, 5)).toBe(
      'Showing 3 matches at offset 10. Try --offset 5 --limit 5 for the previous page.',
    );
  });

});
