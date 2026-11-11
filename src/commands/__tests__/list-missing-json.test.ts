import { describe, expect, it } from 'vitest';
import {
  formatListMissingJson,
  type ListMissingJson,
} from '../list.js';

describe('savestate list --json when missing', () => {
  it('prints a page-compatible missing list summary as JSON', () => {
    const parsed = JSON.parse(formatListMissingJson()) as ListMissingJson & {
      snapshots?: unknown;
      adapter?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      total: 0,
      shown: 0,
      remaining: 0,
      emptyReason: 'collection',
      offset: 0,
      limit: 50,
      pageSize: 50,
      page: 1,
      totalPages: 0,
      hasPrevious: false,
      previousOffset: null,
      hasMore: false,
      nextOffset: null,
      suggestedOffset: null,
      oldestFirst: false,
      filters: {
        since: null,
        until: null,
        platform: null,
        adapter: null,
        exclude: [],
        snapshot: null,
        tag: null,
        label: null,
      },
      entries: [],
      storage: null,
    });
    expect(parsed.snapshots).toBeUndefined();
    expect(parsed.adapter).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'emptyReason',
      'entries',
      'filters',
      'found',
      'hasMore',
      'hasPrevious',
      'limit',
      'nextOffset',
      'offset',
      'oldestFirst',
      'page',
      'pageSize',
      'previousOffset',
      'remaining',
      'shown',
      'storage',
      'suggestedOffset',
      'total',
      'totalPages',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
