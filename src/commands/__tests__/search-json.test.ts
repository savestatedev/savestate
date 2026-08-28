import { describe, expect, it } from 'vitest';
import { formatSearchResultsJson } from '../search.js';
import type { SearchResult } from '../../types.js';

const match: SearchResult = {
  snapshotId: 'ss-2026-01-26T09-30-00-b7c1m4',
  snapshotTimestamp: '2026-01-26T09:30:00.000Z',
  type: 'memory',
  content: 'cocktail recommendations',
  context: 'Favorite cocktail recommendations from last week',
  score: 0.84,
  path: 'memory/core.json',
};

describe('savestate search --json', () => {
  it('prints ranked results as JSON', () => {
    const parsed = JSON.parse(formatSearchResultsJson([match])) as SearchResult[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.snapshotId).toBe(match.snapshotId);
    expect(parsed[0]?.type).toBe('memory');
    expect(parsed[0]?.score).toBe(0.84);
    expect(parsed[0]?.path).toBe('memory/core.json');
  });

  it('prints an empty array when there are no matches', () => {
    expect(formatSearchResultsJson([])).toBe('[]');
  });
});
