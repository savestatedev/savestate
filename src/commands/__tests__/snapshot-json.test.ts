import { describe, expect, it } from 'vitest';
import { formatSnapshotResultJson } from '../snapshot.js';
import type { CreateSnapshotResult } from '../../snapshot.js';

const result = {
  snapshot: {
    manifest: {
      id: 'ss-2026-01-26T09-30-00-b7c1m4',
      timestamp: '2026-01-26T09:30:00.000Z',
      platform: 'claude-code',
      adapter: 'claude-code',
      label: 'pre-update',
      parent: 'ss-2026-01-25T09-30-00-aaaaaa',
    },
  },
  incremental: true,
  fileCount: 12,
  archiveSize: 4096,
  encryptedSize: 4608,
  delta: {
    added: 2,
    modified: 1,
    removed: 0,
    unchanged: 9,
    bytesSaved: 1024,
    chainDepth: 3,
  },
} as CreateSnapshotResult;

describe('savestate snapshot --json', () => {
  it('prints snapshot metadata as JSON', () => {
    const parsed = JSON.parse(
      formatSnapshotResultJson(result, { adapter: 'Claude Code', storage: 'local', stateEventCount: 2 }),
    ) as {
      snapshotId: string;
      adapter: string;
      label: string | null;
      incremental: boolean;
      parent: string | null;
      fileCount: number;
      storage: string | null;
      stateEventCount: number;
      delta: { added: number; bytesSaved: number; chainDepth: number } | null;
    };
    expect(parsed.snapshotId).toBe(result.snapshot.manifest.id);
    expect(parsed.adapter).toBe('Claude Code');
    expect(parsed.label).toBe('pre-update');
    expect(parsed.incremental).toBe(true);
    expect(parsed.parent).toBe('ss-2026-01-25T09-30-00-aaaaaa');
    expect(parsed.fileCount).toBe(12);
    expect(parsed.storage).toBe('local');
    expect(parsed.stateEventCount).toBe(2);
    expect(parsed.delta?.added).toBe(2);
    expect(parsed.delta?.bytesSaved).toBe(1024);
    expect(parsed.delta?.chainDepth).toBe(3);
  });

  it('records a missing label and a full snapshot', () => {
    const parsed = JSON.parse(
      formatSnapshotResultJson(
        {
          ...result,
          incremental: false,
          delta: undefined,
          snapshot: { ...result.snapshot, manifest: { ...result.snapshot.manifest, label: undefined, parent: undefined } },
        } as CreateSnapshotResult,
      ),
    ) as { label: string | null; parent: string | null; incremental: boolean; delta: null; storage: string | null };
    expect(parsed.label).toBeNull();
    expect(parsed.parent).toBeNull();
    expect(parsed.incremental).toBe(false);
    expect(parsed.delta).toBeNull();
    expect(parsed.storage).toBeNull();
  });
});
