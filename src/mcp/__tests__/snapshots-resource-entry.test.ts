import { describe, expect, it } from 'vitest';
import { formatSnapshotsResourceEntry } from '../snapshots-resource-entry.js';

describe('MCP savestate://snapshots entries', () => {
  it('includes the source adapter with each snapshot', () => {
    expect(formatSnapshotsResourceEntry({
      id: 'snapshot-1',
      timestamp: '2026-10-27T12:00:00.000Z',
      platform: 'claude-code',
      adapter: 'claude-code',
      label: 'Daily backup',
      tags: [' release ', 'RELEASE', 'team'],
      size: 2048,
      filename: 'snapshot-1.saf.enc',
    })).toEqual({
      id: 'snapshot-1',
      timestamp: '2026-10-27T12:00:00.000Z',
      platform: 'claude-code',
      adapter: 'claude-code',
      label: 'Daily backup',
      tags: ['release', 'team'],
      size: 2048,
    });
  });

  it('returns null for legacy snapshots without a label', () => {
    const legacyEntry = {
      id: 'snapshot-2',
      timestamp: '2026-10-27T12:00:00.000Z',
      platform: 'claude-code',
      adapter: 'claude-code',
      label: null,
      tags: undefined,
      size: 1024,
      filename: 'snapshot-2.saf.enc',
    } as unknown as Parameters<typeof formatSnapshotsResourceEntry>[0];

    expect(formatSnapshotsResourceEntry(legacyEntry)).toMatchObject({ label: null, tags: [] });
  });
});
