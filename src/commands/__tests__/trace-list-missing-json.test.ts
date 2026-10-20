import { describe, expect, it } from 'vitest';
import {
  formatTraceListMissingJson,
  type TraceListMissingJson,
} from '../trace.js';

describe('savestate trace list --json when missing', () => {
  it('prints a missing run list summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatTraceListMissingJson()) as TraceListMissingJson & {
      runs?: unknown;
      events?: unknown;
      payload?: unknown;
      secret?: unknown;
      file?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      total: 0,
      shown: 0,
    });
    expect(parsed.runs).toBeUndefined();
    expect(parsed.events).toBeUndefined();
    expect(parsed.payload).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(parsed.file).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'shown', 'total']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('keeps pagination metadata for --json-summary when missing', () => {
    const parsed = JSON.parse(formatTraceListMissingJson(true)) as {
      found: boolean;
      runs: unknown[];
      pagination: Record<string, unknown>;
    };
    expect(parsed).toEqual({
      found: false,
      runs: [],
      pagination: {
        offset: 0,
        limit: null,
        total: 0,
        shown: 0,
        emptyReason: 'collection',
        hasMore: false,
        nextOffset: null,
        hasPrevious: false,
        previousOffset: null,
        suggestedOffset: null,
      },
    });
  });
});
