import { describe, expect, it } from 'vitest';
import {
  applyEvalQualityFilters,
  parseEvalQualityOffset,
  selectEvalQualityOffsetEntries,
} from '../eval.js';

describe('savestate eval quality --offset', () => {
  it('defaults to undefined', () => {
    expect(parseEvalQualityOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseEvalQualityOffset('0')).toBe(0);
    expect(parseEvalQualityOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseEvalQualityOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseEvalQualityOffset('1000')).toBe(1000);
    expect(() => parseEvalQualityOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N suites', () => {
    expect(
      selectEvalQualityOffsetEntries(
        [{ name: 'recall' }, { name: 'precision' }, { name: 'stale' }],
        1,
      ).map((suite) => suite.name),
    ).toEqual(['precision', 'stale']);
  });

  it('returns all suites when offset is omitted', () => {
    const suites = [{ name: 'recall' }, { name: 'precision' }];
    expect(selectEvalQualityOffsetEntries(suites, undefined)).toEqual(suites);
  });

  it('skips suites before --limit', () => {
    expect(
      applyEvalQualityFilters(
        [{ name: 'recall' }, { name: 'precision' }, { name: 'stale' }],
        { offset: '1', limit: '1' },
      ).map((suite) => suite.name),
    ).toEqual(['precision']);
  });
});
