import { describe, expect, it } from 'vitest';
import { parseRestoreInclude } from '../restore.js';

describe('savestate restore --include', () => {
  it('defaults to undefined', () => {
    expect(parseRestoreInclude(undefined)).toBeUndefined();
  });

  it('accepts known categories', () => {
    expect(parseRestoreInclude('memory')).toEqual(['memory']);
    expect(parseRestoreInclude('identity, conversations')).toEqual(['identity', 'conversations']);
    expect(parseRestoreInclude('identity,memory,conversations')).toEqual([
      'identity',
      'memory',
      'conversations',
    ]);
  });

  it.each(['nope', '', 'memory,bogus', ',,'])('rejects invalid value %s', (value) => {
    expect(() => parseRestoreInclude(value)).toThrow(
      `Invalid --include value "${value}". Expected one or more of: identity, memory, conversations.`,
    );
  });
});
