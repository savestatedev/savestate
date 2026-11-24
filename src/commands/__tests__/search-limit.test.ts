import { describe, expect, it } from 'vitest';
import {
  parseSearchLimit,
  parseSearchPage,
  resolveSearchLimit,
  resolveSearchOffset,
} from '../search.js';

describe('savestate search --limit', () => {
  it('defaults to 20 results', () => {
    expect(parseSearchLimit(undefined)).toBe(20);
  });

  it('accepts positive integers', () => {
    expect(parseSearchLimit('12')).toBe(12);
  });

  it('accepts surrounding whitespace', () => {
    expect(parseSearchLimit(' 12 ')).toBe(12);
    expect(parseSearchLimit(' 1')).toBe(1);
  });

  it.each(['0', '-1', '1.5', 'nope', ''])('rejects invalid value %s', (value) => {
    expect(() => parseSearchLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSearchLimit('1000')).toBe(1000);
    expect(() => parseSearchLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('accepts the readable page-size alias', () => {
    expect(resolveSearchLimit(undefined, '12')).toBe(12);
  });

  it('rejects combining limit option names', () => {
    expect(() => resolveSearchLimit('10', '12')).toThrow(
      'Cannot use --limit with --page-size; choose one page-size option.',
    );
  });

  it('resolves a 1-based page into a bounded offset', () => {
    expect(parseSearchPage('2')).toBe(2);
    expect(resolveSearchOffset(undefined, '3', 20)).toBe(40);
  });

  it('rejects ambiguous or out-of-range page navigation', () => {
    expect(() => resolveSearchOffset('20', '2', 20)).toThrow(
      'Cannot use --page with --offset; choose one pagination mode.',
    );
    expect(() => resolveSearchOffset(undefined, '52', 20)).toThrow(
      'maximum supported offset of 1000',
    );
  });
});
