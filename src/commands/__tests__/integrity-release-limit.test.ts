import { describe, expect, it } from 'vitest';
import { parseIntegrityReleaseLimit, selectIntegrityReleaseEntries } from '../integrity.js';

describe('savestate integrity release --limit', () => {
  it('defaults to undefined', () => {
    expect(parseIntegrityReleaseLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseIntegrityReleaseLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityReleaseLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseIntegrityReleaseLimit('1000')).toBe(1000);
    expect(() => parseIntegrityReleaseLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectIntegrityReleaseEntries(
        [{ id: 'status' }, { id: 'event' }, { id: 'reason' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['status', 'event']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'reason' }];
    expect(selectIntegrityReleaseEntries(entries, undefined)).toEqual(entries);
  });
});
