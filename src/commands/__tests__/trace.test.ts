import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeProject } from '../../config.js';
import { TraceStore } from '../../trace/index.js';
import { traceExportCommand, traceListCommand, traceShowCommand } from '../trace.js';

describe.sequential('trace commands', () => {
  let cwd: string;
  let originalCwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'savestate-trace-command-'));
    originalCwd = process.cwd();
    await initializeProject(cwd);
    process.chdir(cwd);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(cwd, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('trace list --json returns indexed runs', async () => {
    const store = new TraceStore({ cwd, redactSecrets: false });
    await store.appendEvent('run-1', {
      timestamp: '2026-02-21T10:00:00.000Z',
      run_id: 'run-1',
      adapter: 'clawdbot',
      event_type: 'message',
      payload: { text: 'first' },
    });
    await store.appendEvent('run-2', {
      timestamp: '2026-02-21T10:01:00.000Z',
      run_id: 'run-2',
      adapter: 'clawdbot',
      event_type: 'message',
      payload: { text: 'second' },
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await traceListCommand({ json: true });

    const raw = logSpy.mock.calls
      .map((call) => call[0])
      .find((entry) => typeof entry === 'string' && entry.trim().startsWith('['));
    const runs = JSON.parse(raw as string) as Array<{ run_id: string }>;

    expect(runs.map((run) => run.run_id)).toEqual(['run-2', 'run-1']);
  });

  it('trace list --json is backward compatible when trace is absent', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await traceListCommand({ json: true });

    const raw = logSpy.mock.calls
      .map((call) => call[0])
      .find((entry) => typeof entry === 'string' && entry.trim().startsWith('['));
    const runs = JSON.parse(raw as string) as unknown[];

    expect(runs).toEqual([]);
  });

  it('trace show --json returns events for a run', async () => {
    const store = new TraceStore({ cwd, redactSecrets: false });
    await store.appendEvent('run-show', {
      timestamp: '2026-02-21T10:00:00.000Z',
      run_id: 'run-show',
      adapter: 'clawdbot',
      event_type: 'tool_call',
      payload: { name: 'search' },
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await traceShowCommand('run-show', { json: true });

    const raw = logSpy.mock.calls
      .map((call) => call[0])
      .find((entry) => typeof entry === 'string' && entry.trim().startsWith('['));
    const events = JSON.parse(raw as string) as Array<{ run_id: string; event_type: string }>;

    expect(events).toHaveLength(1);
    expect(events[0].run_id).toBe('run-show');
    expect(events[0].event_type).toBe('tool_call');
  });

  it('trace show exits when the run is missing', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`process.exit:${code ?? 0}`);
      }) as never);

    await expect(traceShowCommand('does-not-exist', {})).rejects.toThrow('process.exit:1');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('trace export writes jsonl for all runs and a specific run', async () => {
    const store = new TraceStore({ cwd, redactSecrets: false });
    await store.appendEvent('run-1', {
      timestamp: '2026-02-21T10:00:00.000Z',
      run_id: 'run-1',
      adapter: 'clawdbot',
      event_type: 'message',
      payload: { text: 'first' },
    });
    await store.appendEvent('run-2', {
      timestamp: '2026-02-21T10:01:00.000Z',
      run_id: 'run-2',
      adapter: 'clawdbot',
      event_type: 'checkpoint',
      payload: { ok: true },
    });

    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((() => true) as never);

    await traceExportCommand({ format: 'jsonl' });
    const allOutput = writeSpy.mock.calls
      .map((call) => String(call[0]))
      .join('');
    const allLines = allOutput.trim().split('\n');
    expect(allLines).toHaveLength(2);

    writeSpy.mockClear();
    await traceExportCommand({ format: 'jsonl', run: 'run-2' });
    const runOutput = writeSpy.mock.calls
      .map((call) => String(call[0]))
      .join('');
    const runLines = runOutput.trim().split('\n');
    expect(runLines).toHaveLength(1);
    expect(JSON.parse(runLines[0]) as { run_id: string }).toMatchObject({ run_id: 'run-2' });
  });
});
