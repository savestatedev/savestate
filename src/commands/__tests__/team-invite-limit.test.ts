import { describe, expect, it } from 'vitest';
import { parseTeamInviteLimit, selectTeamInviteEntries } from '../team.js';

describe('savestate team invite --limit', () => {
  it('defaults to undefined', () => {
    expect(parseTeamInviteLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseTeamInviteLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTeamInviteLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseTeamInviteLimit('1000')).toBe(1000);
    expect(() => parseTeamInviteLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N status field rows', () => {
    expect(
      selectTeamInviteEntries(
        [{ id: 'status' }, { id: 'email' }, { id: 'role' }],
        2,
      ).map((entry) => entry.id),
    ).toEqual(['status', 'email']);
  });

  it('returns all rows when --limit is omitted', () => {
    const entries = [{ id: 'status' }, { id: 'email' }];
    expect(selectTeamInviteEntries(entries, undefined)).toEqual(entries);
  });
});
