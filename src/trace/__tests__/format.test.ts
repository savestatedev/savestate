import { describe, expect, it } from 'vitest';
import { SAF_VERSION, packSnapshot, unpackSnapshot } from '../../format.js';
import type { Snapshot } from '../../types.js';
import { TRACE_SCHEMA_VERSION } from '../types.js';

function createSnapshot(): Snapshot {
  return {
    manifest: {
      version: SAF_VERSION,
      timestamp: '2026-02-21T10:00:00.000Z',
      id: 'ss-test',
      platform: 'openclaw',
      adapter: 'clawdbot',
      checksum: 'abc',
      size: 123,
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
      version: '0.3.0',
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
  };
}

describe('format trace integration', () => {
  it('packs and unpacks trace files when trace data exists', () => {
    const snapshot = createSnapshot();
    snapshot.trace = {
      schema_version: TRACE_SCHEMA_VERSION,
      index: [
        {
          run_id: 'run-1',
          adapter: 'clawdbot',
          file: 'run-run-1.jsonl',
          event_count: 1,
          started_at: '2026-02-21T10:00:00.000Z',
          updated_at: '2026-02-21T10:00:00.000Z',
        },
      ],
      runs: {
        'run-1': '{"timestamp":"2026-02-21T10:00:00.000Z","run_id":"run-1","adapter":"clawdbot","event_type":"message","payload":{"text":"hi"}}\n',
      },
    };

    const files = packSnapshot(snapshot);
    expect(files.has('trace/index.json')).toBe(true);
    expect(files.has('trace/runs/run-run-1.jsonl')).toBe(true);

    const unpacked = unpackSnapshot(files);
    expect(unpacked.trace).toBeDefined();
    expect(unpacked.trace?.schema_version).toBe(TRACE_SCHEMA_VERSION);
    expect(unpacked.trace?.index).toHaveLength(1);
    expect(unpacked.trace?.runs['run-1']).toContain('"run_id":"run-1"');
  });

  it('remains backward compatible when trace files are missing', () => {
    const snapshot = createSnapshot();
    const files = packSnapshot(snapshot);

    const unpacked = unpackSnapshot(files);
    expect(unpacked.trace).toBeUndefined();
  });
});

