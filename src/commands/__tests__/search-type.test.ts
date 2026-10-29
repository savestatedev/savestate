import { describe, expect, it } from 'vitest';
import { formatSearchTypeFilter, parseSearchType } from '../search.js';

describe('savestate search --type', () => {
  it('defaults to undefined', () => {
    expect(parseSearchType(undefined)).toBeUndefined();
  });

  it('accepts known types', () => {
    expect(parseSearchType('memory')).toEqual(['memory']);
    expect(parseSearchType('conversation, identity')).toEqual(['conversation', 'identity']);
    expect(parseSearchType('knowledge')).toEqual(['knowledge']);
  });

  it('normalizes casing and removes repeated types', () => {
    expect(parseSearchType(' MEMORY,conversation,memory ')).toEqual(['memory', 'conversation']);
  });

  it.each(['nope', '', 'memory,bogus', ',,', 'memory,', 'memory,,conversation'])('rejects invalid value %s', (value) => {
    expect(() => parseSearchType(value)).toThrow(
      `Invalid --type value "${value}". Expected one or more of: memory, conversation, identity, knowledge.`,
    );
  });

  it('renders an explicit empty filter after exclusions', () => {
    expect(formatSearchTypeFilter([])).toBe('none');
    expect(formatSearchTypeFilter(['memory', 'identity'])).toBe('memory, identity');
    expect(formatSearchTypeFilter(undefined)).toBeUndefined();
  });
});
