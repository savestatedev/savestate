import { describe, expect, it } from 'vitest';
import { formatTeamInviteJson, type TeamInviteJson } from '../team.js';

const invite: TeamInviteJson = {
  email: 'new@b.co',
  role: 'viewer',
  acceptedAt: null,
  invitedAt: '2026-09-06T00:00:00.000Z',
};

describe('savestate team invite --json', () => {
  it('prints the invited member as JSON', () => {
    const parsed = JSON.parse(formatTeamInviteJson(invite)) as TeamInviteJson & {
      apiKey?: string;
      teamId?: string;
      accountId?: string;
    };
    expect(parsed.email).toBe('new@b.co');
    expect(parsed.role).toBe('viewer');
    expect(parsed.acceptedAt).toBeNull();
    expect(parsed.invitedAt).toBe('2026-09-06T00:00:00.000Z');
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.teamId).toBeUndefined();
    expect(parsed.accountId).toBeUndefined();
  });

  it('records an accepted invite without extra fields', () => {
    const parsed = JSON.parse(
      formatTeamInviteJson({
        email: 'a@b.co',
        role: 'admin',
        acceptedAt: '2026-09-06T12:00:00.000Z',
        invitedAt: '2026-09-06T00:00:00.000Z',
      }),
    ) as TeamInviteJson;
    expect(parsed.role).toBe('admin');
    expect(parsed.acceptedAt).toBe('2026-09-06T12:00:00.000Z');
    expect(Object.keys(parsed).sort()).toEqual(['acceptedAt', 'email', 'invitedAt', 'role']);
  });
});
