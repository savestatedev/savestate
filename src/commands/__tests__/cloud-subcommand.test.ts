import { describe, expect, it } from 'vitest';
import { parseCloudSubcommand } from '../cloud.js';

describe('savestate cloud subcommand', () => {
  it('accepts a single cloud subcommand', () => {
    expect(parseCloudSubcommand('push')).toBe('push');
    expect(parseCloudSubcommand('pull')).toBe('pull');
    expect(parseCloudSubcommand('list')).toBe('list');
    expect(parseCloudSubcommand('delete')).toBe('delete');
    expect(parseCloudSubcommand(' LIST ')).toBe('list');
  });

  it.each(['', ' ', ',', 'push,pull', 'cloud list', 'status'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseCloudSubcommand(value)).toThrow(
        `Invalid subcommand "${value}". Expected a single non-empty cloud subcommand (push, pull, list, delete).`,
      );
    },
  );

  it('rejects a missing value', () => {
    expect(() => parseCloudSubcommand(undefined)).toThrow(
      'Invalid subcommand. Expected a single non-empty cloud subcommand (push, pull, list, delete).',
    );
  });
});
