import { describe, expect, it } from 'vitest';
import { parseMigrateInclude } from '../migrate.js';

describe('savestate migrate --include', () => {
  it('defaults to undefined', () => {
    expect(parseMigrateInclude(undefined)).toBeUndefined();
  });

  it('accepts known types', () => {
    expect(parseMigrateInclude('memories')).toEqual(['memories']);
    expect(parseMigrateInclude('instructions, files')).toEqual(['instructions', 'files']);
    expect(parseMigrateInclude('instructions,memories,conversations,files,customBots')).toEqual([
      'instructions',
      'memories',
      'conversations',
      'files',
      'customBots',
    ]);
  });

  it.each(['nope', '', 'memories,bogus', ',,'])('rejects invalid value %s', (value) => {
    expect(() => parseMigrateInclude(value)).toThrow(
      `Invalid --include value "${value}". Expected one or more of: instructions, memories, conversations, files, customBots.`,
    );
  });
});
