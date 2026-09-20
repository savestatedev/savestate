import { describe, expect, it } from 'vitest';
import { parseIdentitySubcommand } from '../identity.js';

describe('savestate identity subcommand', () => {
  it('accepts a single identity subcommand', () => {
    expect(parseIdentitySubcommand('show')).toBe('show');
    expect(parseIdentitySubcommand('init')).toBe('init');
    expect(parseIdentitySubcommand('set')).toBe('set');
    expect(parseIdentitySubcommand('schema')).toBe('schema');
    expect(parseIdentitySubcommand(' SHOW ')).toBe('show');
  });

  it.each(['', ' ', ',', 'show,init', 'identity show', 'status'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseIdentitySubcommand(value)).toThrow(
        `Invalid subcommand "${value}". Expected a single non-empty identity subcommand (show, init, set, schema).`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseIdentitySubcommand(undefined)).toThrow(
      'Invalid subcommand. Expected a single non-empty identity subcommand (show, init, set, schema).',
    );
  });
});
