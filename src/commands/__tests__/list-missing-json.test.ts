import { describe, expect, it } from 'vitest';
import {
  formatListMissingJson,
  formatListMissingJsonSummary,
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
      previousPage: null,
      hasPrevious: false,
      previousOffset: null,
      hasMore: false,
      nextPage: null,
      nextOffset: null,
      maxOffset: 1000,
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
      'maxOffset',
      'nextOffset',
      'nextPage',
      'offset',
      'oldestFirst',
      'page',
      'pageSize',
      'previousOffset',
      'previousPage',
      'remaining',
      'shown',
      'storage',
      'suggestedOffset',
      'total',
      'totalPages',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('omits entries from the missing JSON summary shape', () => {
    const parsed = JSON.parse(formatListMissingJsonSummary()) as Record<string, unknown>;

    expect(parsed).toMatchObject({
      found: false,
      total: 0,
      shown: 0,
      emptyReason: 'collection',
      page: 1,
      totalPages: 0,
      nextOffset: null,
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
    });
    expect(parsed).not.toHaveProperty('entries');
    expect(parsed).not.toHaveProperty('storage');
  });

  it('preserves requested page metadata when filters are supplied', () => {
    const parsed = JSON.parse(formatListMissingJson(2, 4, true, {
      platform: ' ChatGPT ',
      exclude: [' Claude-Web '],
      label: ' Nightly ',
    }));

    expect(parsed).toMatchObject({
      offset: 4,
      limit: 2,
      pageSize: 2,
      page: 3,
      oldestFirst: true,
      filters: {
        platform: 'chatgpt',
        exclude: ['claude-web'],
        label: 'nightly',
      },
    });
  });
});
