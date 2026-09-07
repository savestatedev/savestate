import { describe, expect, it } from 'vitest';
import { formatTeamAuditJson, type TeamAuditJson } from '../team.js';

const result: TeamAuditJson & { secret?: string } = {
  teamId: 't-7',
  count: 2,
  nextCursor: null,
  entries: [
    {
      id: 'evt-1',
      action: 'team.created',
      actorAccountId: 'acct-1',
      resourceType: 'team',
      resourceId: 't-7',
      createdAt: '2026-09-06T12:00:00.000Z',
    },
    {
      id: 'evt-2',
      action: 'member.invited',
      actorAccountId: 'acct-1',
      resourceType: 'member',
      resourceId: 'a@b.co',
      createdAt: '2026-09-06T12:05:00.000Z',
    },
  ],
  secret: 'ss_live_SECRET',
};

describe('savestate team audit --json', () => {
  it('prints audit entries as JSON without extra fields', () => {
    const parsed = JSON.parse(formatTeamAuditJson(result)) as TeamAuditJson & {
      secret?: unknown;
      apiKey?: string;
      entries: Array<TeamAuditJson['entries'][number] & { metadata?: unknown }>;
    };
    expect(parsed).toEqual({
      teamId: 't-7',
      count: 2,
      nextCursor: null,
      entries: [
        {
          id: 'evt-1',
          action: 'team.created',
          actorAccountId: 'acct-1',
          resourceType: 'team',
          resourceId: 't-7',
          createdAt: '2026-09-06T12:00:00.000Z',
        },
        {
          id: 'evt-2',
          action: 'member.invited',
          actorAccountId: 'acct-1',
          resourceType: 'member',
          resourceId: 'a@b.co',
          createdAt: '2026-09-06T12:05:00.000Z',
        },
      ],
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.entries[1]?.metadata).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records an empty audit log without extra fields', () => {
    const parsed = JSON.parse(
      formatTeamAuditJson({
        teamId: 't-8',
        count: 0,
        nextCursor: null,
        entries: [],
      }),
    ) as TeamAuditJson;
    expect(parsed.teamId).toBe('t-8');
    expect(parsed.count).toBe(0);
    expect(parsed.nextCursor).toBeNull();
    expect(parsed.entries).toEqual([]);
    expect(Object.keys(parsed).sort()).toEqual(['count', 'entries', 'nextCursor', 'teamId']);
  });
});
