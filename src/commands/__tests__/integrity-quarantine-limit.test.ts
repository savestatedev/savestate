import { describe, expect, it } from 'vitest';
import { parseIntegrityQuarantineLimit, selectIntegrityQuarantineEntries } from '../integrity.js';

describe('savestate integrity quarantine --limit', () => {
  it('defaults to undefined', () => {
    expect(parseIntegrityQuarantineLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseIntegrityQuarantineLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityQuarantineLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseIntegrityQuarantineLimit('1000')).toBe(1000);
    expect(() => parseIntegrityQuarantineLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectIntegrityQuarantineEntries(
        [{ id: 'status' }, { id: 'event' }, { id: 'reason' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['status', 'event']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'reason' }];
    expect(selectIntegrityQuarantineEntries(entries, undefined)).toEqual(entries);
  });
});
