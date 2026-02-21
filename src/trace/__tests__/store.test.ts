import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { TRACE_SCHEMA_VERSION, TraceStore, type TraceEvent } from '../index.js';

describe('TraceStore', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'savestate-trace-store-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('appends events and updates run index', async () => {
    const store = new TraceStore({ cwd });
    const event: TraceEvent = {
      timestamp: '2026-02-21T10:00:00.000Z',
      run_id: 'run-1',
      adapter: 'clawdbot',
      event_type: 'message',
      payload: { text: 'hello' },
      tags: ['mvp'],
    };

    await store.appendEvent('run-1', event);

    const indexPath = join(cwd, '.savestate', 'traces', 'index.json');
    const index = JSON.parse(await readFile(indexPath, 'utf-8')) as {
      schema_version: number;
      runs: Array<{ run_id: string; event_count: number; tags?: string[] }>;
    };

    expect(index.schema_version).toBe(TRACE_SCHEMA_VERSION);
    expect(index.runs).toHaveLength(1);
    expect(index.runs[0].run_id).toBe('run-1');
    expect(index.runs[0].event_count).toBe(1);
    expect(index.runs[0].tags).toEqual(['mvp']);
  });

  it('lists runs and exports jsonl for one run or all runs', async () => {
    const store = new TraceStore({ cwd, redactSecrets: false });

    const run1Event: TraceEvent = {
      timestamp: '2026-02-21T10:00:00.000Z',
      run_id: 'run-1',
      adapter: 'clawdbot',
      event_type: 'tool_call',
      payload: { name: 'search' },
    };
    const run2Event: TraceEvent = {
      timestamp: '2026-02-21T10:01:00.000Z',
      run_id: 'run-2',
      adapter: 'clawdbot',
      event_type: 'tool_result',
      payload: { ok: true },
    };

    await store.appendEvent('run-1', run1Event);
    await store.appendEvent('run-2', run2Event);

    const runs = await store.listRuns();
    expect(runs.map((run) => run.run_id)).toEqual(['run-2', 'run-1']);

    const run1Export = await store.export('run-1', 'jsonl');
    expect(run1Export.trim().split('\n')).toHaveLength(1);
    expect(JSON.parse(run1Export.trim()) as TraceEvent).toMatchObject({ run_id: 'run-1' });

    const allExport = await store.export('all', 'jsonl');
    expect(allExport.trim().split('\n')).toHaveLength(2);
  });

  it('redacts sensitive payload keys by default', async () => {
    const store = new TraceStore({ cwd });
    const event: TraceEvent = {
      timestamp: '2026-02-21T10:00:00.000Z',
      run_id: 'run-1',
      adapter: 'clawdbot',
      event_type: 'error',
      payload: {
        token: 'abc',
        api_key: 'xyz',
        nested: {
          authorization: 'Bearer 123',
          passphrase: 'hunter2',
          secret: 'shh',
          keep: 'value',
        },
      },
    };

    await store.appendEvent('run-1', event);
    const events = await store.getRun('run-1');

    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({
      token: '[REDACTED]',
      api_key: '[REDACTED]',
      nested: {
        authorization: '[REDACTED]',
        passphrase: '[REDACTED]',
        secret: '[REDACTED]',
        keep: 'value',
      },
    });
  });

  it('preserves secrets when redaction is explicitly disabled', async () => {
    const store = new TraceStore({ cwd, redactSecrets: false });
    const event: TraceEvent = {
      timestamp: '2026-02-21T10:00:00.000Z',
      run_id: 'run-1',
      adapter: 'clawdbot',
      event_type: 'message',
      payload: {
        token: 'raw-token',
      },
    };

    await store.appendEvent('run-1', event);
    const events = await store.getRun('run-1');

    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({ token: 'raw-token' });
  });
});

