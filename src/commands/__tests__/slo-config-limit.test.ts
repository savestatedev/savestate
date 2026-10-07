import { describe, expect, it } from 'vitest';
import { parseSloConfigLimit, selectSloConfigEntries } from '../slo.js';

describe('savestate slo config --limit', () => {
  it('defaults to undefined', () => {
    expect(parseSloConfigLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseSloConfigLimit('12')).toBe(12);
  });

  it.each(['', '-1', '1.5', '1e2', '0x10', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseSloConfigLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseSloConfigLimit('1000')).toBe(1000);
    expect(() => parseSloConfigLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N configuration setting rows', () => {
    expect(
      selectSloConfigEntries(
        [{ id: 'enabled' }, { id: 'alert_threshold_percent' }, { id: 'evaluation_interval_minutes' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['enabled', 'alert_threshold_percent']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'enabled' }, { id: 'alert_threshold_percent' }];
    expect(selectSloConfigEntries(entries, undefined)).toEqual(entries);
  });
});
