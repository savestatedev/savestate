import { describe, expect, it } from 'vitest';
import { parseTeamInviteRole } from '../team.js';

describe('savestate team invite --role', () => {
  it('defaults to member', () => {
    expect(parseTeamInviteRole(undefined)).toBe('member');
  });

  it('accepts known invite roles', () => {
    expect(parseTeamInviteRole('admin')).toBe('admin');
    expect(parseTeamInviteRole('member')).toBe('member');
    expect(parseTeamInviteRole('VIEWER')).toBe('viewer');
    expect(parseTeamInviteRole(' Admin ')).toBe('admin');
  });

  it.each(['', ' ', 'nope', 'owner', '1'])('rejects invalid value %s', (value) => {
    expect(() => parseTeamInviteRole(value)).toThrow(
      `Invalid --role value "${value}". Expected one of: admin, member, viewer.`,
    );
  });
});
