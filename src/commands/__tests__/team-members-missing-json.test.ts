import { describe, expect, it } from 'vitest';
import {
  formatTeamMembersMissingJson,
  type TeamMembersMissingJson,
} from '../team.js';

describe('savestate team members --json when missing', () => {
  it('prints a missing team members summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatTeamMembersMissingJson()) as TeamMembersMissingJson & {
      members?: unknown;
      emails?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      name: null,
      total: 0,
      shown: 0,
    });
    expect(parsed.members).toBeUndefined();
    expect(parsed.emails).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'name', 'shown', 'total']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
