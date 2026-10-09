import { describe, expect, it } from 'vitest';
import { parseEvalReportLimit, selectEvalReportSuites } from '../eval.js';

describe('savestate eval report --limit', () => {
  it('defaults to undefined', () => {
    expect(parseEvalReportLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseEvalReportLimit('12')).toBe(12);
  });

  it('accepts surrounding whitespace', () => {
    expect(parseEvalReportLimit(' 12 ')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseEvalReportLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseEvalReportLimit('1000')).toBe(1000);
    expect(() => parseEvalReportLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N suites', () => {
    expect(
      selectEvalReportSuites(
        [{ name: 'recall' }, { name: 'precision' }, { name: 'stale' }],
        2,
      ).map((suite) => suite.name),
    ).toEqual(['recall', 'precision']);
  });

  it('returns all suites when --limit is omitted', () => {
    const suites = [{ name: 'recall' }, { name: 'precision' }];
    expect(selectEvalReportSuites(suites, undefined)).toEqual(suites);
  });
});
