import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SAF_VERSION } from '../../format.js';
import { TraceStore } from '../../trace/index.js';
import type { Snapshot } from '../../types.js';
import { ClawdbotAdapter } from '../clawdbot.js';

function createSnapshot(trace?: Snapshot['trace']): Snapshot {
  return {
    manifest: {
      version: SAF_VERSION,
      timestamp: '2026-02-21T10:00:00.000Z',
      id: 'ss-test',
      platform: 'openclaw',
      adapter: 'clawdbot',
      checksum: '',
      size: 0,
    },
    identity: {},
    memory: {
      core: [],
      knowledge: [],
    },
    conversations: {
      total: 0,
      conversations: [],
    },
    platform: {
      name: 'OpenClaw',
      exportMethod: 'direct-file-access',
    },
    chain: {
      current: 'ss-test',
      ancestors: [],
    },
    restoreHints: {
      platform: 'openclaw',
      steps: [],
    },
    trace,
  };
}

describe('ClawdbotAdapter trace integration', () => {
  let workspaceDir: string;
  let homeDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'savestate-claw-trace-workspace-'));
    homeDir = await mkdtemp(join(tmpdir(), 'savestate-claw-trace-home-'));
    originalHome = process.env.HOME;
    process.env.HOME = homeDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(workspaceDir, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  it('includes local trace ledger in extract()', async () => {
    const traceStore = new TraceStore({ cwd: workspaceDir, redactSecrets: false });
    await traceStore.appendEvent('run-1', {
      timestamp: '2026-02-21T10:00:00.000Z',
      run_id: 'run-1',
      adapter: 'clawdbot',
      event_type: 'message',
      payload: { text: 'trace hello' },
    });

    const adapter = new ClawdbotAdapter(workspaceDir, { includeMemoryDatabases: false });
    const snapshot = await adapter.extract();

    expect(snapshot.trace).toBeDefined();
    expect(snapshot.trace?.index).toHaveLength(1);
    expect(snapshot.trace?.index[0].run_id).toBe('run-1');
    expect(snapshot.trace?.runs['run-1']).toContain('trace hello');
  });

  it('writes trace ledger back during restore()', async () => {
    const adapter = new ClawdbotAdapter(workspaceDir, { includeMemoryDatabases: false });
    const snapshot = createSnapshot({
      schema_version: 1,
      index: [
        {
          run_id: 'run-restore',
          adapter: 'clawdbot',
          file: 'run-run-restore.jsonl',
          event_count: 1,
          started_at: '2026-02-21T10:00:00.000Z',
          updated_at: '2026-02-21T10:00:00.000Z',
        },
      ],
      runs: {
        'run-restore': '{"timestamp":"2026-02-21T10:00:00.000Z","run_id":"run-restore","adapter":"clawdbot","event_type":"checkpoint","payload":{"step":"done"}}\n',
      },
    });

    await adapter.restore(snapshot);

    const traceStore = new TraceStore({ cwd: workspaceDir, redactSecrets: false });
    const runs = await traceStore.listRuns();
    const events = await traceStore.getRun('run-restore');

    expect(runs).toHaveLength(1);
    expect(runs[0].run_id).toBe('run-restore');
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('checkpoint');
    expect(events[0].payload).toEqual({ step: 'done' });
  });
});

