import { describe, expect, it } from 'vitest';
import {
  formatSearchResultsJson,
  formatSearchMissingSummaryJson,
  formatSearchResultsSummaryJson,
} from '../search.js';
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

  it('prints pagination metadata without changing the result fields', () => {
    const parsed = JSON.parse(
      formatSearchResultsSummaryJson({
        query: 'cocktail recommendations',
        results: [match],
        offset: 10,
        limit: 5,
      }),
    ) as {
      found: boolean;
      query: string;
      results: SearchResult[];
      pagination: Record<string, unknown>;
    };

    expect(parsed.found).toBe(true);
    expect(parsed.query).toBe('cocktail recommendations');
    expect(parsed.results).toEqual([match]);
    expect(parsed.pagination).toEqual({
      offset: 10,
      limit: 5,
      shown: 1,
      emptyReason: null,
      suggestedOffset: null,
      hasMore: false,
      nextOffset: null,
      hasPrevious: true,
      previousOffset: 5,
    });
  });

  it('points full pages at the next and previous offsets', () => {
    const parsed = JSON.parse(
      formatSearchResultsSummaryJson({
        query: 'cocktail',
        results: [match, match],
        offset: 10,
        limit: 2,
      }),
    ) as { pagination: Record<string, unknown> };

    expect(parsed.pagination).toMatchObject({
      hasMore: true,
      nextOffset: 12,
      hasPrevious: true,
      previousOffset: 8,
    });
  });

  it('identifies an empty collection separately from an exhausted page', () => {
    const firstPage = JSON.parse(
      formatSearchResultsSummaryJson({ query: 'missing', results: [] }),
    ) as { pagination: Record<string, unknown> };
    const laterPage = JSON.parse(
      formatSearchResultsSummaryJson({
        query: 'missing',
        results: [],
        offset: 10,
        limit: 5,
      }),
    ) as { pagination: Record<string, unknown> };

    expect(firstPage.pagination.emptyReason).toBe('collection');
    expect(laterPage.pagination.emptyReason).toBe('page');
    expect(laterPage.pagination.suggestedOffset).toBe(5);
  });

  it('keeps the summary envelope complete for missing snapshots', () => {
    const parsed = JSON.parse(
      formatSearchMissingSummaryJson('missing', 'ss-missing', 5, 2),
    ) as {
      found: boolean;
      pagination: Record<string, unknown>;
    };

    expect(parsed.found).toBe(false);
    expect(parsed.pagination).toMatchObject({
      offset: 5,
      limit: 2,
      shown: 0,
      emptyReason: 'collection',
      suggestedOffset: null,
      hasMore: false,
      nextOffset: null,
      hasPrevious: true,
      previousOffset: 3,
    });
  });
});
