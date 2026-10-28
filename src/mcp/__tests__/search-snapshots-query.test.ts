import { describe, expect, it } from 'vitest';
import { parseSearchSnapshotsQuery } from '../search-snapshots-query.js';

describe('MCP savestate_search_snapshots query', () => {
  it('trims surrounding whitespace before searching', () => {
    expect(parseSearchSnapshotsQuery('  migration notes  ')).toBe('migration notes');
  });

  it.each(['', '   ', '\t\n'])('rejects whitespace-only queries', (value) => {
    expect(() => parseSearchSnapshotsQuery(value)).toThrow(
      'Invalid query value. Expected a non-empty search query.',
    );
  });
});
