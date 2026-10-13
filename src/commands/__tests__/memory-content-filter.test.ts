import { describe, expect, it } from 'vitest';
import { parseMemoryContentFilter } from '../memory-cli.js';

describe('savestate memory list --content', () => {
  it('allows the filter to be omitted', () => {
    expect(parseMemoryContentFilter(undefined)).toBeUndefined();
  });

  it('keeps validation for a supplied filter', () => {
    expect(parseMemoryContentFilter('  editor  ')).toBe('editor');
    expect(() => parseMemoryContentFilter('   ')).toThrow(
      'Invalid --content value "   ". Expected non-empty memory content.',
    );
  });
});
