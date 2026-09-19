import { describe, expect, it } from 'vitest';
import { parseAntibodiesSubcommand } from '../antibodies.js';

describe('savestate antibodies subcommand', () => {
  it('accepts a single antibodies subcommand', () => {
    expect(parseAntibodiesSubcommand('list')).toBe('list');
    expect(parseAntibodiesSubcommand('add')).toBe('add');
    expect(parseAntibodiesSubcommand('preflight')).toBe('preflight');
    expect(parseAntibodiesSubcommand('stats')).toBe('stats');
    expect(parseAntibodiesSubcommand(' LIST ')).toBe('list');
  });

  it.each(['', ' ', ',', 'list,add', 'antibodies list', 'status'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseAntibodiesSubcommand(value)).toThrow(
        `Invalid subcommand "${value}". Expected a single non-empty antibodies subcommand (list, add, preflight, stats).`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseAntibodiesSubcommand(undefined)).toThrow(
      'Invalid subcommand. Expected a single non-empty antibodies subcommand (list, add, preflight, stats).',
    );
  });
});
