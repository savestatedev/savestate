import { describe, expect, it } from 'vitest';
import { parseIntegrityIncidentLimit, selectIntegrityIncidentEntries } from '../integrity.js';

describe('savestate integrity incident --limit', () => {
  it('defaults to undefined', () => {
    expect(parseIntegrityIncidentLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseIntegrityIncidentLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityIncidentLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseIntegrityIncidentLimit('1000')).toBe(1000);
    expect(() => parseIntegrityIncidentLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N event rows', () => {
    expect(
      selectIntegrityIncidentEntries(
        [{ id: 'evt-1' }, { id: 'evt-2' }, { id: 'evt-3' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['evt-1', 'evt-2']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'evt-1' }, { id: 'evt-2' }];
    expect(selectIntegrityIncidentEntries(entries, undefined)).toEqual(entries);
  });
});
