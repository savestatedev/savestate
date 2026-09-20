import { describe, expect, it } from 'vitest';
import { parseRestoreExclude } from '../restore.js';

describe('savestate restore --exclude', () => {
  it('defaults to undefined', () => {
    expect(parseRestoreExclude(undefined)).toBeUndefined();
  });

  it('accepts known categories', () => {
    expect(parseRestoreExclude('memory')).toEqual(['memory']);
    expect(parseRestoreExclude('identity, conversations')).toEqual(['identity', 'conversations']);
    expect(parseRestoreExclude('identity,memory,conversations')).toEqual([
      'identity',
      'memory',
      'conversations',
    ]);
  });

  it.each(['nope', '', 'memory,bogus', ',,'])('rejects invalid value %s', (value) => {
    expect(() => parseRestoreExclude(value)).toThrow(
      `Invalid --exclude value "${value}". Expected one or more of: identity, memory, conversations.`,
    );
  });
});
