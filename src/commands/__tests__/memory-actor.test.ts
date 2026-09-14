import { describe, expect, it } from 'vitest';
import { parseMemoryActor } from '../memory-cli.js';

describe('savestate memory --actor', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryActor(undefined)).toBeUndefined();
  });

  it('accepts a single actor id', () => {
    expect(parseMemoryActor('cli-user')).toBe('cli-user');
    expect(parseMemoryActor('admin-1')).toBe('admin-1');
    expect(parseMemoryActor(' editor-1 ')).toBe('editor-1');
  });

  it.each(['', ' ', ',', 'cli-user,admin-1', 'cli user'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryActor(value)).toThrow(
      `Invalid --actor value "${value}". Expected a single non-empty actor id.`,
    );
  });
});
