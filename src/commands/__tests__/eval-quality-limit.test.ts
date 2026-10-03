import { describe, expect, it } from 'vitest';
import { parseEvalQualityLimit, selectEvalQualitySuites } from '../eval.js';

describe('savestate eval quality --limit', () => {
  it('defaults to undefined', () => {
    expect(parseEvalQualityLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseEvalQualityLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseEvalQualityLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseEvalQualityLimit('1000')).toBe(1000);
    expect(() => parseEvalQualityLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N suites', () => {
    expect(
      selectEvalQualitySuites(
        [{ name: 'recall' }, { name: 'precision' }, { name: 'stale' }],
        2,
      ).map((suite) => suite.name),
    ).toEqual(['recall', 'precision']);
  });

  it('returns all suites when --limit is omitted', () => {
    const suites = [{ name: 'recall' }, { name: 'precision' }];
    expect(selectEvalQualitySuites(suites, undefined)).toEqual(suites);
  });
});
