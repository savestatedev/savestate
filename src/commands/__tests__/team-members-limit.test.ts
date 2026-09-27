import { describe, expect, it } from 'vitest';
import { parseTeamMembersLimit, selectTeamMembers } from '../team.js';

describe('savestate team members --limit', () => {
  it('defaults to undefined', () => {
    expect(parseTeamMembersLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseTeamMembersLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseTeamMembersLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseTeamMembersLimit('1000')).toBe(1000);
    expect(() => parseTeamMembersLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('keeps the first N members', () => {
    expect(
      selectTeamMembers(
        [{ email: 'a@b.co' }, { email: 'c@d.co' }, { email: 'e@f.co' }],
        2,
      ).map((member) => member.email),
    ).toEqual(['a@b.co', 'c@d.co']);
  });

  it('returns all members when --limit is omitted', () => {
    const members = [{ email: 'a@b.co' }, { email: 'c@d.co' }];
    expect(selectTeamMembers(members, undefined)).toEqual(members);
  });
});
