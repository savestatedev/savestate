import { describe, expect, it } from 'vitest';
import { parseSloReportLimit, selectSloReportNamespaces } from '../slo.js';

describe('savestate slo report --limit', () => {
  it('defaults to undefined', () => {
    expect(parseSloReportLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseSloReportLimit('12')).toBe(12);
  });

  it.each(['', '-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseSloReportLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSloReportLimit('1000')).toBe(1000);
    expect(() => parseSloReportLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N namespace rows', () => {
    expect(
      selectSloReportNamespaces(
        [{ namespace: 'a' }, { namespace: 'b' }, { namespace: 'c' }],
        2,
      ).map((row) => row.namespace),
    ).toEqual(['a', 'b']);
  });

  it('returns all rows when --limit is omitted', () => {
    const rows = [{ namespace: 'a' }, { namespace: 'b' }];
    expect(selectSloReportNamespaces(rows, undefined)).toEqual(rows);
  });
});
