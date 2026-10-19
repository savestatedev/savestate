import { describe, expect, it } from 'vitest';
import type { TraceRunIndexEntry } from '../../trace/index.js';
import { formatTraceExportJson, type TraceExportJson } from '../trace.js';

const run: TraceRunIndexEntry & { secret?: string; payload?: unknown } = {
  run_id: 'run-123',
  adapter: 'claude-code',
  file: '/Users/me/.savestate/traces/runs/run-123.jsonl',
  event_count: 2,
  started_at: '2026-09-04T12:00:00.000Z',
  updated_at: '2026-09-04T12:01:00.000Z',
  tags: ['mcp'],
  secret: 'ss_live_SECRET',
  payload: { token: 'ss_live_SECRET' },
};

describe('savestate trace export --json', () => {
  it('prints an export summary as JSON without extra fields', () => {
    const input = {
      format: 'jsonl',
      run: 'all',
      runs: [run],
      file: '/Users/me/.savestate/traces/index.json',
      payload: { token: 'ss_live_SECRET' },
    };
    const parsed = JSON.parse(formatTraceExportJson(input)) as TraceExportJson & {
      secret?: unknown;
      apiKey?: string;
      file?: unknown;
      payload?: unknown;
    };
    expect(parsed).toEqual({
      found: true,
      format: 'jsonl',
      run: 'all',
      runCount: 1,
      eventCount: 2,
      pagination: {
        offset: 0,
        limit: null,
        total: 1,
        shown: 1,
        hasMore: false,
        nextOffset: null,
        previousOffset: null,
        suggestedOffset: null,
      },
      runs: [
        {
          runId: 'run-123',
          adapter: 'claude-code',
          eventCount: 2,
          startedAt: '2026-09-04T12:00:00.000Z',
          updatedAt: '2026-09-04T12:01:00.000Z',
          tags: ['mcp'],
        },
      ],
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.file).toBeUndefined();
    expect(parsed.payload).toBeUndefined();
    expect(parsed.runs[0]).not.toHaveProperty('file');
    expect(parsed.runs[0]).not.toHaveProperty('payload');
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records empty export defaults without extra fields', () => {
    const parsed = JSON.parse(formatTraceExportJson({})) as TraceExportJson;
    expect(parsed.format).toBe('jsonl');
    expect(parsed.found).toBe(true);
    expect(parsed.run).toBe('all');
    expect(parsed.runCount).toBe(0);
    expect(parsed.eventCount).toBe(0);
    expect(parsed.pagination).toEqual({
      offset: 0,
      limit: null,
      total: 0,
      shown: 0,
      hasMore: false,
      nextOffset: null,
      previousOffset: null,
      suggestedOffset: null,
    });
    expect(parsed.runs).toEqual([]);
    expect(Object.keys(parsed).sort()).toEqual([
      'eventCount',
      'format',
      'found',
      'pagination',
      'run',
      'runCount',
      'runs',
    ]);
  });

  it('reports recovery offsets for a bounded export page', () => {
    const parsed = JSON.parse(formatTraceExportJson({
      format: 'jsonl',
      run: 'all',
      runs: [run],
      offset: 2,
      limit: 1,
      total: 4,
    })) as TraceExportJson;

    expect(parsed.pagination).toEqual({
      offset: 2,
      limit: 1,
      total: 4,
      shown: 1,
      hasMore: true,
      nextOffset: 3,
      previousOffset: 1,
      suggestedOffset: null,
    });
  });

  it('suggests the last valid page when a bounded export is empty', () => {
    const parsed = JSON.parse(formatTraceExportJson({
      runs: [],
      offset: 9,
      limit: 3,
      total: 8,
    })) as TraceExportJson;

    expect(parsed.pagination).toMatchObject({
      offset: 9,
      limit: 3,
      total: 8,
      shown: 0,
      hasMore: false,
      nextOffset: null,
      previousOffset: 6,
      suggestedOffset: 6,
    });
  });
});
