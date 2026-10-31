import { describe, expect, it } from 'vitest';
import {
  formatMemoryExplainMissingJson,
  type MemoryExplainMissingJson,
} from '../memory.js';

describe('savestate memory explain --json when missing', () => {
  it('prints a missing memory explanation as JSON without extra fields', () => {
    const parsed = JSON.parse(
      formatMemoryExplainMissingJson('inbox preference'),
    ) as MemoryExplainMissingJson & {
      results?: unknown;
      content?: unknown;
      previous_content?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      query: 'inbox preference',
      shown: 0,
      emptyReason: 'collection',
      suggestedOffset: null,
      pagination: {
        offset: 0,
        limit: null,
        total: 0,
        remaining: 0,
        pageSize: 1,
        hasPrevious: false,
        previousOffset: null,
        hasMore: false,
        nextOffset: null,
      },
      results: null,
    });
    expect(parsed.content).toBeUndefined();
    expect(parsed.previous_content).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'emptyReason',
      'found',
      'pagination',
      'query',
      'results',
      'shown',
      'suggestedOffset',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('preserves the freshness filter when no results match', () => {
    const parsed = JSON.parse(
      formatMemoryExplainMissingJson(
        'inbox preference',
        {},
        { freshness: 'stale' },
      ),
    ) as MemoryExplainMissingJson;

    expect(parsed.filters).toEqual({ freshness: 'stale' });
  });

  it('preserves every active scope filter when no results match', () => {
    const parsed = JSON.parse(
      formatMemoryExplainMissingJson(
        'inbox preference',
        {},
        {
          namespace: 'org:app:agent',
          source: 'claude',
          tags: ['personal'],
          freshness: 'needs_confirmation',
        },
      ),
    ) as MemoryExplainMissingJson;

    expect(parsed.filters).toEqual({
      namespace: 'org:app:agent',
      source: 'claude',
      tags: ['personal'],
      freshness: 'needs_confirmation',
    });
  });

  it('includes the resolved snapshot when provided', () => {
    const parsed = JSON.parse(
      formatMemoryExplainMissingJson(
        'inbox preference',
        {},
        undefined,
        'ss-2026-10-18',
      ),
    ) as MemoryExplainMissingJson;

    expect(parsed.snapshot).toBe('ss-2026-10-18');
  });
});
