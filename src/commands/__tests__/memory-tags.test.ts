import { describe, expect, it } from 'vitest';
import { parseMemoryTags } from '../memory-cli.js';

describe('savestate memory --tags', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryTags(undefined)).toBeUndefined();
  });

  it('accepts one or more memory tags', () => {
    expect(parseMemoryTags('prefs')).toEqual(['prefs']);
    expect(parseMemoryTags('important,v2')).toEqual(['important', 'v2']);
    expect(parseMemoryTags(' weekly , backup ')).toEqual(['weekly', 'backup']);
  });

  it.each(['', ' ', ',', 'prefs,', ',v2', 'a,,b'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryTags(value)).toThrow(
      `Invalid --tags value "${value}". Expected one or more non-empty memory tags (comma-separated).`,
    );
  });
});
