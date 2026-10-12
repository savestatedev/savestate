import { describe, expect, it } from 'vitest';
import { parseMemoryPinnedFilter } from '../memory-cli.js';

describe('savestate memory list pin filters', () => {
  it('returns false for --unpinned', () => {
    expect(parseMemoryPinnedFilter(undefined, true)).toBe(false);
  });

  it('returns true for --pinned', () => {
    expect(parseMemoryPinnedFilter(true, undefined)).toBe(true);
  });

  it('rejects conflicting pin filters', () => {
    expect(() => parseMemoryPinnedFilter(true, true)).toThrow(
      'The --pinned and --unpinned options cannot be used together.',
    );
  });
});
