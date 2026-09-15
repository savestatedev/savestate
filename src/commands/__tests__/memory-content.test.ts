import { describe, expect, it } from 'vitest';
import { parseMemoryContent } from '../memory-cli.js';

describe('savestate memory --content', () => {
  it('accepts non-empty memory content', () => {
    expect(parseMemoryContent('Updated preference')).toBe('Updated preference');
    expect(parseMemoryContent('Prefer dark mode, then sync')).toBe('Prefer dark mode, then sync');
    expect(parseMemoryContent(' Updated preference ')).toBe('Updated preference');
  });

  it.each(['', ' '])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryContent(value)).toThrow(
      `Invalid --content value "${value}". Expected non-empty memory content.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseMemoryContent(undefined)).toThrow(
      'Invalid --content value. Expected non-empty memory content.',
    );
  });
});
