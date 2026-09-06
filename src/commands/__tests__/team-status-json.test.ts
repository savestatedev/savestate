import { describe, expect, it } from 'vitest';
import { formatTeamStatusJson, type TeamStatusJson } from '../team.js';

const status: TeamStatusJson = {
  id: 'team_abc',
  name: 'Acme',
  role: 'admin',
  createdAt: '2026-01-26T00:00:00.000Z',
};

describe('savestate team status --json', () => {
  it('prints team membership as JSON', () => {
    const parsed = JSON.parse(formatTeamStatusJson(status)) as TeamStatusJson & { apiKey?: string };
    expect(parsed.id).toBe('team_abc');
    expect(parsed.name).toBe('Acme');
    expect(parsed.role).toBe('admin');
    expect(parsed.createdAt).toBe('2026-01-26T00:00:00.000Z');
    expect(parsed.apiKey).toBeUndefined();
  });

  it('records a viewer without extra fields', () => {
    const parsed = JSON.parse(
      formatTeamStatusJson({
        id: 'team_xyz',
        name: 'Beta',
        role: 'viewer',
        createdAt: '2026-09-06T00:00:00.000Z',
      }),
    ) as TeamStatusJson;
    expect(parsed.role).toBe('viewer');
    expect(parsed.name).toBe('Beta');
    expect(Object.keys(parsed).sort()).toEqual(['createdAt', 'id', 'name', 'role']);
  });
});
