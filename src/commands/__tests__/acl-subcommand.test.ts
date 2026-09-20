import { describe, expect, it } from 'vitest';
import { parseAclSubcommand } from '../acl.js';

describe('savestate acl subcommand', () => {
  it('accepts a single acl subcommand', () => {
    expect(parseAclSubcommand('propose')).toBe('propose');
    expect(parseAclSubcommand('verify')).toBe('verify');
    expect(parseAclSubcommand('gate')).toBe('gate');
    expect(parseAclSubcommand('list')).toBe('list');
    expect(parseAclSubcommand(' LIST ')).toBe('list');
  });

  it.each(['', ' ', ',', 'propose,list', 'acl list', 'status'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseAclSubcommand(value)).toThrow(
        `Invalid subcommand "${value}". Expected a single non-empty acl subcommand (propose, verify, gate, list).`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseAclSubcommand(undefined)).toThrow(
      'Invalid subcommand. Expected a single non-empty acl subcommand (propose, verify, gate, list).',
    );
  });
});
