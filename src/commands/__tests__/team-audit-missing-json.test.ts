import { describe, expect, it } from 'vitest';
import {
  formatTeamAuditMissingJson,
  type TeamAuditMissingJson,
} from '../team.js';

describe('savestate team audit --json when missing', () => {
  it('prints a missing team audit summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatTeamAuditMissingJson()) as TeamAuditMissingJson & {
      entries?: unknown;
      events?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      teamId: null,
      count: 0,
      nextCursor: null,
    });
    expect(parsed.entries).toBeUndefined();
    expect(parsed.events).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['count', 'found', 'nextCursor', 'teamId']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
