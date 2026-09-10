import { describe, expect, it } from 'vitest';
import {
  formatTeamStatusMissingJson,
  type TeamStatusMissingJson,
} from '../team.js';

describe('savestate team status --json when missing', () => {
  it('prints a missing team status summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatTeamStatusMissingJson()) as TeamStatusMissingJson & {
      createdAt?: unknown;
      members?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      id: null,
      name: null,
      role: null,
    });
    expect(parsed.createdAt).toBeUndefined();
    expect(parsed.members).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'id', 'name', 'role']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
