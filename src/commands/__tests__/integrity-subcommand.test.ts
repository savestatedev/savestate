import { describe, expect, it } from 'vitest';
import { parseIntegritySubcommand } from '../integrity.js';

describe('savestate integrity subcommand', () => {
  it('accepts a single integrity subcommand', () => {
    expect(parseIntegritySubcommand('status')).toBe('status');
    expect(parseIntegritySubcommand('seed')).toBe('seed');
    expect(parseIntegritySubcommand('rotate')).toBe('rotate');
    expect(parseIntegritySubcommand('incidents')).toBe('incidents');
    expect(parseIntegritySubcommand('incident')).toBe('incident');
    expect(parseIntegritySubcommand('quarantine')).toBe('quarantine');
    expect(parseIntegritySubcommand('release')).toBe('release');
    expect(parseIntegritySubcommand('config')).toBe('config');
    expect(parseIntegritySubcommand('test')).toBe('test');
    expect(parseIntegritySubcommand('clear')).toBe('clear');
    expect(parseIntegritySubcommand(' STATUS ')).toBe('status');
  });

  it.each(['', ' ', ',', 'status,seed', 'integrity status', 'list'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseIntegritySubcommand(value)).toThrow(
        `Invalid subcommand "${value}". Expected a single non-empty integrity subcommand (status, seed, rotate, incidents, incident, quarantine, release, config, test, clear).`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseIntegritySubcommand(undefined)).toThrow(
      'Invalid subcommand. Expected a single non-empty integrity subcommand (status, seed, rotate, incidents, incident, quarantine, release, config, test, clear).',
    );
  });
});
