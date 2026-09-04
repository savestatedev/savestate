import { describe, expect, it } from 'vitest';
import type { TraceEvent, TraceRunIndexEntry } from '../../trace/index.js';
import {
  formatTraceEventsJson,
  formatTraceRunsJson,
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
});
