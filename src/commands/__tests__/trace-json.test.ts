import { describe, expect, it } from 'vitest';
import type { TraceEvent, TraceRunIndexEntry } from '../../trace/index.js';
import {
  formatTraceEventsJson,
  formatTraceExportJson,
  formatTraceListSummaryJson,
  formatTraceRunsJson,
  formatTraceShowSummaryJson,
  type TraceEventJson,
  type TraceRunJson,
} from '../trace.js';

const run: TraceRunIndexEntry = {
  run_id: 'run-123',
  adapter: 'claude-code',
  file: 'runs/run-123.jsonl',
  event_count: 2,
  started_at: '2026-09-04T12:00:00.000Z',
  updated_at: '2026-09-04T12:01:00.000Z',
  tags: ['mcp'],
};

const event: TraceEvent = {
  timestamp: '2026-09-04T12:00:00.000Z',
  run_id: 'run-123',
  adapter: 'claude-code',
  event_type: 'tool_call',
  payload: { token: 'ss_live_SECRET', args: { query: 'ss_live_SECRET' } },
  tags: ['mcp'],
};

describe('savestate trace --json', () => {
  it('prints runs as JSON without the on-disk file path', () => {
    const parsed = JSON.parse(formatTraceRunsJson([run])) as Array<TraceRunJson & { file?: unknown }>;
    expect(parsed).toEqual([
      {
        runId: 'run-123',
        adapter: 'claude-code',
        eventCount: 2,
        startedAt: '2026-09-04T12:00:00.000Z',
        updatedAt: '2026-09-04T12:01:00.000Z',
        tags: ['mcp'],
      },
    ]);
    expect(parsed[0].file).toBeUndefined();
  });

  it('prints events as JSON without payloads', () => {
    const parsed = JSON.parse(formatTraceEventsJson([event])) as Array<
      TraceEventJson & { payload?: unknown }
    >;
    expect(parsed).toEqual([
      {
        timestamp: '2026-09-04T12:00:00.000Z',
        runId: 'run-123',
        adapter: 'claude-code',
        eventType: 'tool_call',
        tags: ['mcp'],
      },
    ]);
    expect(parsed[0].payload).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records empty tags and empty lists', () => {
    const parsedRun = JSON.parse(
      formatTraceRunsJson([
        {
          run_id: 'run-empty',
          adapter: 'codex',
          file: 'runs/run-empty.jsonl',
          event_count: 0,
          started_at: '2026-09-04T13:00:00.000Z',
          updated_at: '2026-09-04T13:00:00.000Z',
        },
      ]),
    ) as TraceRunJson[];
    expect(parsedRun[0].tags).toEqual([]);
    expect(parsedRun[0].eventCount).toBe(0);

    const parsedEvent = JSON.parse(
      formatTraceEventsJson([
        {
          timestamp: '2026-09-04T13:00:00.000Z',
          run_id: 'run-empty',
          adapter: 'codex',
          event_type: 'checkpoint',
          payload: {},
        },
      ]),
    ) as TraceEventJson[];
    expect(parsedEvent[0].tags).toEqual([]);
    expect(parsedEvent[0].eventType).toBe('checkpoint');
    expect(formatTraceRunsJson([])).toBe('[]');
    expect(formatTraceEventsJson([])).toBe('[]');
  });

  it('adds navigation metadata to paginated summaries', () => {
    const list = JSON.parse(formatTraceListSummaryJson({
      runs: [run],
      offset: 2,
      limit: 1,
      total: 4,
    })) as { pagination: Record<string, unknown> };
    expect(list.pagination).toEqual({
      maxOffset: 1000,
      offset: 2,
      limit: 1,
      total: 4,
      shown: 1,
      emptyReason: null,
      hasMore: true,
      nextOffset: 3,
      hasPrevious: true,
      previousOffset: 1,
      suggestedOffset: null,
    });

    const show = JSON.parse(formatTraceShowSummaryJson({
      runId: 'run-123',
      events: [event],
      offset: 0,
      limit: 1,
      total: 2,
    })) as { pagination: Record<string, unknown> };
    expect(show.pagination.hasMore).toBe(true);
    expect(show.pagination.nextOffset).toBe(1);
  });

  it('does not advertise a next page beyond the bounded offset', () => {
    const summary = JSON.parse(formatTraceListSummaryJson({
      runs: Array.from({ length: 20 }, () => run),
      offset: 990,
      limit: 20,
      total: 2_000,
    })) as { pagination: Record<string, unknown> };

    expect(summary.pagination.hasMore).toBe(true);
    expect(summary.pagination.nextOffset).toBe(1000);

    const maxPage = JSON.parse(formatTraceListSummaryJson({
      runs: Array.from({ length: 20 }, () => run),
      offset: 1000,
      limit: 20,
      total: 2_000,
    })) as { pagination: Record<string, unknown> };
    expect(maxPage.pagination.hasMore).toBe(false);
    expect(maxPage.pagination.nextOffset).toBeNull();
  });

  it('bounds export pagination at the CLI maximum', () => {
    const summary = JSON.parse(formatTraceExportJson({
      runs: Array.from({ length: 20 }, () => run),
      offset: 990,
      limit: 20,
      total: 2_000,
    })) as { pagination: Record<string, unknown> };

    expect(summary.pagination.hasMore).toBe(true);
    expect(summary.pagination.nextOffset).toBe(1000);

    const maxPage = JSON.parse(formatTraceExportJson({
      runs: Array.from({ length: 20 }, () => run),
      offset: 1000,
      limit: 20,
      total: 2_000,
    })) as { pagination: Record<string, unknown> };
    expect(maxPage.pagination.hasMore).toBe(false);
    expect(maxPage.pagination.nextOffset).toBeNull();
  });

  it('keeps empty-page recovery guidance within the CLI maximum', () => {
    const summary = JSON.parse(formatTraceListSummaryJson({
      runs: [],
      offset: 1000,
      limit: 1000,
      total: 5_000,
    })) as { pagination: Record<string, unknown> };

    expect(summary.pagination.suggestedOffset).toBe(1000);
  });

  it('does not advertise a repeated next page for an empty page', () => {
    const summary = JSON.parse(formatTraceListSummaryJson({
      runs: [],
      offset: 100,
      limit: 20,
      total: 5_000,
    })) as { pagination: Record<string, unknown> };

    expect(summary.pagination.hasMore).toBe(false);
    expect(summary.pagination.nextOffset).toBeNull();
  });
});
