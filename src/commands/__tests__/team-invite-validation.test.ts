import { describe, expect, it } from 'vitest';
import { parseTeamInviteEmail } from '../team.js';

describe('savestate team invite email validation', () => {
  it('accepts a trimmed address with one non-empty local and domain part', () => {
    expect(parseTeamInviteEmail('  person@example.com  ')).toBe('person@example.com');
  });

  it.each(['', ' ', '@', 'person@', '@example.com', 'person@example.com@other.com'])(
    'rejects malformed address %s',
    (value) => {
      expect(() => parseTeamInviteEmail(value)).toThrow(
        `Invalid email "${value}". Expected a single non-empty email address.`,
      );
    },
  );
});
