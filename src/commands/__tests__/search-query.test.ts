import { describe, expect, it } from 'vitest';
import { parseSearchQuery } from '../search.js';

describe('savestate search query', () => {
  it('accepts a non-empty query', () => {
    expect(parseSearchQuery('cocktail recommendations')).toBe('cocktail recommendations');
    expect(parseSearchQuery('system prompt, then tools')).toBe('system prompt, then tools');
    expect(parseSearchQuery(' cocktail recommendations ')).toBe('cocktail recommendations');
  });

  it.each(['', ' '])('rejects invalid value %s', (value) => {
    expect(() => parseSearchQuery(value)).toThrow(
      `Invalid search query "${value}". Expected a non-empty query.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseSearchQuery(undefined)).toThrow(
      'Invalid search query. Expected a non-empty query.',
    );
  });
});
