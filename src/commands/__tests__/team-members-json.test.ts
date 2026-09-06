import { describe, expect, it } from 'vitest';
import { formatTeamMembersJson, type TeamMembersJson } from '../team.js';

const result: TeamMembersJson = {
  name: 'Acme',
  members: [
    {
      email: 'a@b.co',
      role: 'owner',
      acceptedAt: '2026-04-01T00:00:00Z',
      invitedAt: '2026-04-01T00:00:00Z',
    },
    {
      email: 'c@d.co',
      role: 'admin',
      acceptedAt: null,
      invitedAt: '2026-04-02T00:00:00Z',
    },
  ],
};

describe('savestate team members --json', () => {
  it('prints team members as JSON', () => {
    const parsed = JSON.parse(formatTeamMembersJson(result)) as TeamMembersJson & { apiKey?: string };
    expect(parsed.name).toBe('Acme');
    expect(parsed.members).toEqual(result.members);
    expect(parsed.apiKey).toBeUndefined();
  });

  it('records an empty roster without extra fields', () => {
    const parsed = JSON.parse(
      formatTeamMembersJson({
        name: 'Beta',
        members: [],
      }),
    ) as TeamMembersJson;
    expect(parsed.name).toBe('Beta');
    expect(parsed.members).toEqual([]);
    expect(Object.keys(parsed).sort()).toEqual(['members', 'name']);
  });
});
