import { describe, expect, it } from 'vitest';
import {
  applyEvalReportFilters,
  parseEvalReportOffset,
  selectEvalReportOffsetEntries,
} from '../eval.js';

describe('savestate eval report --offset', () => {
  it('defaults to undefined', () => {
    expect(parseEvalReportOffset(undefined)).toBeUndefined();
  });

  it('accepts zero and positive integers', () => {
    expect(parseEvalReportOffset('0')).toBe(0);
    expect(parseEvalReportOffset('12')).toBe(12);
  });

  it.each(['-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseEvalReportOffset(value)).toThrow(
      `Invalid --offset value "${value}". Expected a non-negative integer up to 1000.`,
    );
  });

  it('rejects values above the bounded skip count', () => {
    expect(parseEvalReportOffset('1000')).toBe(1000);
    expect(() => parseEvalReportOffset('1001')).toThrow(
      'Invalid --offset value "1001". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips the first N suites', () => {
    expect(
      selectEvalReportOffsetEntries(
        [{ name: 'recall' }, { name: 'precision' }, { name: 'stale' }],
        1,
      ).map((suite) => suite.name),
    ).toEqual(['precision', 'stale']);
  });

  it('returns all suites when offset is omitted', () => {
    const suites = [{ name: 'recall' }, { name: 'precision' }];
    expect(selectEvalReportOffsetEntries(suites, undefined)).toEqual(suites);
  });

  it('skips suites before --limit', () => {
    expect(
      applyEvalReportFilters(
        [{ name: 'recall' }, { name: 'precision' }, { name: 'stale' }],
        { offset: '1', limit: '1' },
      ).map((suite) => suite.name),
    ).toEqual(['precision']);
  });
});
