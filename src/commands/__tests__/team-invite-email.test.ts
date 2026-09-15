import { describe, expect, it } from 'vitest';
import { parseTeamInviteEmail } from '../team.js';

describe('savestate team invite email', () => {
  it('accepts a single email address', () => {
    expect(parseTeamInviteEmail('user@example.com')).toBe('user@example.com');
    expect(parseTeamInviteEmail('new@b.co')).toBe('new@b.co');
    expect(parseTeamInviteEmail(' user@example.com ')).toBe('user@example.com');
  });

  it.each(['', ' ', ',', 'a@b.co,c@d.co', 'user @example.com', 'not-an-email'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseTeamInviteEmail(value)).toThrow(
        `Invalid email "${value}". Expected a single non-empty email address.`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseTeamInviteEmail(undefined)).toThrow(
      'Invalid email. Expected a single non-empty email address.',
    );
  });
});
