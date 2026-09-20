import { describe, expect, it } from 'vitest';
import { parseTeamSubcommand } from '../team.js';

describe('savestate team subcommand', () => {
  it('accepts a single team subcommand', () => {
    expect(parseTeamSubcommand('status')).toBe('status');
    expect(parseTeamSubcommand('members')).toBe('members');
    expect(parseTeamSubcommand('invite')).toBe('invite');
    expect(parseTeamSubcommand('audit')).toBe('audit');
    expect(parseTeamSubcommand(' STATUS ')).toBe('status');
  });

  it.each(['', ' ', ',', 'status,members', 'team status', 'quality'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseTeamSubcommand(value)).toThrow(
        `Invalid subcommand "${value}". Expected a single non-empty team subcommand (status, members, invite, audit).`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseTeamSubcommand(undefined)).toThrow(
      'Invalid subcommand. Expected a single non-empty team subcommand (status, members, invite, audit).',
    );
  });
});
