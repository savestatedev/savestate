import { describe, expect, it } from 'vitest';
import {
  formatTeamInviteMissingJson,
  type TeamInviteMissingJson,
} from '../team.js';

describe('savestate team invite --json when missing', () => {
  it('prints a missing team invite summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatTeamInviteMissingJson()) as TeamInviteMissingJson & {
      acceptedAt?: unknown;
      invitedAt?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      email: null,
      role: null,
    });
    expect(parsed.acceptedAt).toBeUndefined();
    expect(parsed.invitedAt).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['email', 'found', 'role']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
