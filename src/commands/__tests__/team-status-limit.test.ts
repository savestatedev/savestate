import { describe, expect, it } from 'vitest';
import { parseTeamStatusLimit, selectTeamStatusEntries } from '../team.js';

describe('savestate team status --limit', () => {
  it('defaults to undefined', () => {
    expect(parseTeamStatusLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseTeamStatusLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTeamStatusLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseTeamStatusLimit('1000')).toBe(1000);
    expect(() => parseTeamStatusLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectTeamStatusEntries(
        [{ id: 'name' }, { id: 'id' }, { id: 'role' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['name', 'id']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'name' }, { id: 'id' }];
    expect(selectTeamStatusEntries(entries, undefined)).toEqual(entries);
  });
});
