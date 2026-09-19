import { describe, expect, it } from 'vitest';
import { parseMemoryQuery } from '../memory-cli.js';

describe('savestate memory explain query', () => {
  it('accepts a non-empty query', () => {
    expect(parseMemoryQuery('inbox preference')).toBe('inbox preference');
    expect(parseMemoryQuery('system prompt, then tools')).toBe('system prompt, then tools');
    expect(parseMemoryQuery(' inbox preference ')).toBe('inbox preference');
  });

  it.each(['', ' '])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryQuery(value)).toThrow(
      `Invalid memory query "${value}". Expected a non-empty query.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseMemoryQuery(undefined)).toThrow(
      'Invalid memory query. Expected a non-empty query.',
    );
  });
});
