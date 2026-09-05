import { describe, expect, it } from 'vitest';
import { formatDiffJson, type DiffJson } from '../diff.js';
import type { IdentityDiff } from '../../diff/semantic.js';
import type { StateEventDiff } from '../../diff/state-events.js';

const emptyIdentity: IdentityDiff = {
  hasChanges: false,
  changes: [],
  summary: { added: 0, removed: 0, modified: 0 },
};

const emptyState: StateEventDiff = {
  hasChanges: false,
  byType: new Map(),
  summary: { added: 0, removed: 0, modified: 0 },
};

describe('savestate diff --json', () => {
  it('prints identity and state diffs as JSON', () => {
    const identity: IdentityDiff = {
      hasChanges: true,
      changes: [
        {
          type: 'modified',
          path: 'name',
          field: 'name',
          before: 'old',
          after: 'new',
          description: 'name changed',
        },
      ],
      summary: { added: 0, removed: 0, modified: 1 },
      versionChange: { before: '1.0.0', after: '1.1.0' },
    };
    const state: StateEventDiff = {
      hasChanges: true,
      byType: new Map([
        [
          'memory',
          [
            {
              type: 'memory',
              operation: 'added',
              id: 'mem-1',
              description: 'new memory',
            },
          ],
        ],
      ]),
      summary: { added: 1, removed: 0, modified: 0 },
      memoryTierChanges: { promoted: 1, demoted: 0, pinned: 0, unpinned: 0 },
    };

    const parsed = JSON.parse(formatDiffJson('ss-a', 'ss-b', identity, state)) as DiffJson;
    expect(parsed.snapshotA).toBe('ss-a');
    expect(parsed.snapshotB).toBe('ss-b');
    expect(parsed.identity.hasChanges).toBe(true);
    expect(parsed.identity.versionChange).toEqual({ before: '1.0.0', after: '1.1.0' });
    expect(parsed.identity.summary.modified).toBe(1);
    expect(parsed.state.hasChanges).toBe(true);
    expect(parsed.state.byType.memory).toHaveLength(1);
    expect(parsed.state.memoryTierChanges?.promoted).toBe(1);
  });

  it('records empty diffs with no changes', () => {
    const parsed = JSON.parse(formatDiffJson('ss-a', 'ss-b', emptyIdentity, emptyState)) as DiffJson;
    expect(parsed.identity.hasChanges).toBe(false);
    expect(parsed.identity.changes).toEqual([]);
    expect(parsed.state.hasChanges).toBe(false);
    expect(parsed.state.byType).toEqual({});
    expect(parsed.state.summary).toEqual({ added: 0, removed: 0, modified: 0 });
  });
});
