import { describe, expect, it } from 'vitest';
import { parseMigrateExclude, resolveMigrateInclude } from '../migrate.js';

describe('savestate migrate --exclude', () => {
  it('defaults to undefined', () => {
    expect(parseMigrateExclude(undefined)).toBeUndefined();
  });

  it('accepts known types', () => {
    expect(parseMigrateExclude('memories')).toEqual(['memories']);
    expect(parseMigrateExclude('instructions, files')).toEqual(['instructions', 'files']);
    expect(parseMigrateExclude('instructions,memories,conversations,files,customBots')).toEqual([
      'instructions',
      'memories',
      'conversations',
      'files',
      'customBots',
    ]);
  });

  it.each(['nope', '', 'memories,bogus', ',,'])('rejects invalid value %s', (value) => {
    expect(() => parseMigrateExclude(value)).toThrow(
      `Invalid --exclude value "${value}". Expected one or more of: instructions, memories, conversations, files, customBots.`,
    );
  });

  it('drops excluded types from the default set', () => {
    expect(resolveMigrateInclude({ exclude: 'conversations' })).toEqual([
      'instructions',
      'memories',
      'files',
      'customBots',
    ]);
  });

  it('drops excluded types from --include', () => {
    expect(resolveMigrateInclude({ include: 'memories,conversations', exclude: 'conversations' })).toEqual([
      'memories',
    ]);
  });
});
