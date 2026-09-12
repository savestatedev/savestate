import { describe, expect, it } from 'vitest';
import { parseSearchType } from '../search.js';

describe('savestate search --type', () => {
  it('defaults to undefined', () => {
    expect(parseSearchType(undefined)).toBeUndefined();
  });

  it('accepts known types', () => {
    expect(parseSearchType('memory')).toEqual(['memory']);
    expect(parseSearchType('conversation, identity')).toEqual(['conversation', 'identity']);
    expect(parseSearchType('knowledge')).toEqual(['knowledge']);
  });

  it.each(['nope', '', 'memory,bogus', ',,'])('rejects invalid value %s', (value) => {
    expect(() => parseSearchType(value)).toThrow(
      `Invalid --type value "${value}". Expected one or more of: memory, conversation, identity, knowledge.`,
    );
  });
});
