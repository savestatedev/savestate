import { describe, expect, it } from 'vitest';
import {
  formatAdaptersJson,
  formatAdaptersSummaryJson,
  selectAdaptersPlatform,
  type AdapterListEntry,
} from '../adapters.js';

const adapter: AdapterListEntry = {
  id: 'claude-code',
  name: 'Claude Code',
  platform: 'claude-code',
  version: '1.0.0',
  detected: true,
};

describe('savestate adapters --json', () => {
  it('prints adapter records as JSON', () => {
    const parsed = JSON.parse(formatAdaptersJson([adapter])) as AdapterListEntry[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBe('claude-code');
    expect(parsed[0]?.name).toBe('Claude Code');
    expect(parsed[0]?.platform).toBe('claude-code');
    expect(parsed[0]?.version).toBe('1.0.0');
    expect(parsed[0]?.detected).toBe(true);
  });

  it('prints an empty array when there are no adapters', () => {
    expect(formatAdaptersJson([])).toBe('[]');
  });

  it('prints recoverable pagination metadata in summary mode', () => {
    const parsed = JSON.parse(formatAdaptersSummaryJson({
      entries: [adapter],
      total: 3,
      offset: 1,
      limit: 1,
    })) as {
      found: boolean;
      entries: AdapterListEntry[];
      pagination: {
        total: number;
        shown: number;
        offset: number;
        page: number;
        totalPages: number;
        hasPrevious: boolean;
        previousOffset: number | null;
        hasMore: boolean;
        nextOffset: number | null;
        emptyReason: string | null;
      };
    };

    expect(parsed.found).toBe(true);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.pagination).toMatchObject({
      total: 3,
      shown: 1,
      offset: 1,
      page: 2,
      totalPages: 3,
      hasPrevious: true,
      previousOffset: 0,
      hasMore: true,
      nextOffset: 2,
      emptyReason: null,
    });
  });

  it('suggests the previous page when a summary offset is exhausted', () => {
    const parsed = JSON.parse(formatAdaptersSummaryJson({
      entries: [],
      total: 1,
      offset: 2,
      limit: 1,
    })) as { pagination: { emptyReason: string; suggestedOffset: number } };

    expect(parsed.pagination).toEqual(expect.objectContaining({
      emptyReason: 'page',
      suggestedOffset: 1,
    }));
  });

  it('matches platform filters without case or whitespace surprises', () => {
    expect(selectAdaptersPlatform([adapter], ' Claude-CODE ')).toEqual([adapter]);
  });
});
