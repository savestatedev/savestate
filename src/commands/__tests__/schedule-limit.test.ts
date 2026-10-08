import { describe, expect, it } from 'vitest';
import { parseScheduleLimit, selectScheduleStatusEntries } from '../schedule.js';

describe('savestate schedule --limit', () => {
  it('defaults to undefined', () => {
    expect(parseScheduleLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseScheduleLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', '0x10', '1e2', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseScheduleLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseScheduleLimit('1000')).toBe(1000);
    expect(() => parseScheduleLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectScheduleStatusEntries(
        [{ id: 'enabled' }, { id: 'interval' }, { id: 'job' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['enabled', 'interval']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'enabled' }, { id: 'interval' }];
    expect(selectScheduleStatusEntries(entries, undefined)).toEqual(entries);
  });
});
