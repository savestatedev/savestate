import { describe, expect, it } from 'vitest';
import { formatRestoreResultJson } from '../restore.js';
import type { RestoreResult } from '../../restore.js';

const result: RestoreResult = {
  snapshotId: 'ss-2026-01-26T09-30-00-b7c1m4',
  timestamp: '2026-01-26T09:30:00.000Z',
  platform: 'claude-code',
  adapter: 'claude-code',
  label: 'before-migrate',
  memoryCount: 12,
  conversationCount: 3,
  hasIdentity: true,
  stateEventCount: 4,
};

describe('savestate restore --json', () => {
  it('prints restore metadata as JSON', () => {
    const parsed = JSON.parse(formatRestoreResultJson(result)) as RestoreResult & { dryRun: boolean; label: string | null };
    expect(parsed.snapshotId).toBe(result.snapshotId);
    expect(parsed.platform).toBe('claude-code');
    expect(parsed.adapter).toBe('claude-code');
    expect(parsed.label).toBe('before-migrate');
    expect(parsed.memoryCount).toBe(12);
    expect(parsed.conversationCount).toBe(3);
    expect(parsed.hasIdentity).toBe(true);
    expect(parsed.stateEventCount).toBe(4);
    expect(parsed.dryRun).toBe(false);
  });

  it('records dry-run and a missing label', () => {
    const parsed = JSON.parse(
      formatRestoreResultJson({ ...result, label: undefined }, { dryRun: true }),
    ) as { label: string | null; dryRun: boolean };
    expect(parsed.label).toBeNull();
    expect(parsed.dryRun).toBe(true);
  });
});
