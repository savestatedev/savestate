import { describe, expect, it } from 'vitest';
import { diffStateEvents, formatStateEventDiff } from '../state-events.js';
import type { Snapshot, MemoryEntry, ConversationMeta } from '../../types.js';

function createMinimalSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    manifest: {
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      id: 'test-snapshot',
      platform: 'test',
      adapter: 'test',
      checksum: 'abc123',
      size: 1000,
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
      name: 'test',
      exportMethod: 'api',
    },
    chain: {
      current: 'test-snapshot',
      ancestors: [],
    },
    restoreHints: {
      platform: 'test',
      steps: [],
    },
    ...overrides,
  };
}

function createMemoryEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: 'mem-1',
    content: 'Test memory content',
    source: 'user_input',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('diffStateEvents', () => {
  it('returns no changes for identical snapshots', () => {
    const snapshot = createMinimalSnapshot();
    const diff = diffStateEvents(snapshot, snapshot);

    expect(diff.hasChanges).toBe(false);
    expect(diff.summary.added).toBe(0);
    expect(diff.summary.removed).toBe(0);
    expect(diff.summary.modified).toBe(0);
  });

  it('detects added memory entries', () => {
    const before = createMinimalSnapshot();
    const after = createMinimalSnapshot({
      memory: {
        core: [createMemoryEntry({ id: 'new-mem' })],
        knowledge: [],
      },
    });

    const diff = diffStateEvents(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.added).toBe(1);
    expect(diff.byType.get('memory')).toBeDefined();
  });

  it('detects removed memory entries', () => {
    const before = createMinimalSnapshot({
      memory: {
        core: [createMemoryEntry({ id: 'old-mem' })],
        knowledge: [],
      },
    });
    const after = createMinimalSnapshot();

    const diff = diffStateEvents(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.removed).toBe(1);
  });

  it('detects modified memory entries', () => {
    const before = createMinimalSnapshot({
      memory: {
        core: [createMemoryEntry({ id: 'mem-1', content: 'Old content' })],
        knowledge: [],
      },
    });
    const after = createMinimalSnapshot({
      memory: {
        core: [createMemoryEntry({ id: 'mem-1', content: 'New content' })],
        knowledge: [],
      },
    });

    const diff = diffStateEvents(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.modified).toBe(1);
  });

  it('detects new conversations', () => {
    const before = createMinimalSnapshot();
    const after = createMinimalSnapshot({
      conversations: {
        total: 1,
        conversations: [
          {
            id: 'conv-1',
            title: 'New Conversation',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messageCount: 5,
            path: 'conversations/conv-1.json',
          },
        ],
      },
    });

    const diff = diffStateEvents(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.byType.get('conversation')).toBeDefined();
    expect(diff.byType.get('conversation')!.length).toBe(1);
  });

  it('detects conversations with new messages', () => {
    const conv: ConversationMeta = {
      id: 'conv-1',
      title: 'Test Conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 5,
      path: 'conversations/conv-1.json',
    };

    const before = createMinimalSnapshot({
      conversations: {
        total: 1,
        conversations: [conv],
      },
    });
    const after = createMinimalSnapshot({
      conversations: {
        total: 1,
        conversations: [{ ...conv, messageCount: 10 }],
      },
    });

    const diff = diffStateEvents(before, after);

    expect(diff.hasChanges).toBe(true);
    const convChanges = diff.byType.get('conversation');
    expect(convChanges).toBeDefined();
    expect(convChanges!.some((c) => c.operation === 'modified')).toBe(true);
  });

  it('categorizes decisions correctly', () => {
    const before = createMinimalSnapshot();
    const after = createMinimalSnapshot({
      memory: {
        core: [
          createMemoryEntry({
            id: 'decision-1',
            content: 'I decided to use TypeScript',
            source: 'decision',
          }),
        ],
        knowledge: [],
      },
    });

    const diff = diffStateEvents(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.byType.get('decision')).toBeDefined();
  });

  it('categorizes preferences correctly', () => {
    const before = createMinimalSnapshot();
    const after = createMinimalSnapshot({
      memory: {
        core: [
          createMemoryEntry({
            id: 'pref-1',
            content: 'User prefers dark mode',
            source: 'preference',
          }),
        ],
        knowledge: [],
      },
    });

    const diff = diffStateEvents(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.byType.get('preference')).toBeDefined();
  });

  it('categorizes errors correctly', () => {
    const before = createMinimalSnapshot();
    const after = createMinimalSnapshot({
      memory: {
        core: [
          createMemoryEntry({
            id: 'error-1',
            content: 'Error: Connection failed',
            source: 'error',
          }),
        ],
        knowledge: [],
      },
    });

    const diff = diffStateEvents(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.byType.get('error')).toBeDefined();
  });

  it('tracks memory tier changes', () => {
    const before = createMinimalSnapshot({
      memory: {
        core: [createMemoryEntry({ id: 'mem-1', tier: 'L3' })],
        knowledge: [],
      },
    });
    const after = createMinimalSnapshot({
      memory: {
        core: [createMemoryEntry({ id: 'mem-1', tier: 'L1' })],
        knowledge: [],
      },
    });

    const diff = diffStateEvents(before, after);

    expect(diff.memoryTierChanges).toBeDefined();
    expect(diff.memoryTierChanges!.promoted).toBe(1);
  });

  it('tracks pinned/unpinned changes', () => {
    const before = createMinimalSnapshot({
      memory: {
        core: [createMemoryEntry({ id: 'mem-1', pinned: false })],
        knowledge: [],
      },
    });
    const after = createMinimalSnapshot({
      memory: {
        core: [createMemoryEntry({ id: 'mem-1', pinned: true })],
        knowledge: [],
      },
    });

    const diff = diffStateEvents(before, after);

    expect(diff.memoryTierChanges).toBeDefined();
    expect(diff.memoryTierChanges!.pinned).toBe(1);
  });

  it('handles undefined snapshots', () => {
    const diff = diffStateEvents(undefined, undefined);
    expect(diff.hasChanges).toBe(false);
  });

  it('detects knowledge document changes', () => {
    const before = createMinimalSnapshot();
    const after = createMinimalSnapshot({
      memory: {
        core: [],
        knowledge: [
          {
            id: 'doc-1',
            filename: 'guide.pdf',
            mimeType: 'application/pdf',
            path: 'knowledge/guide.pdf',
            size: 1000,
            checksum: 'abc123',
          },
        ],
      },
    });

    const diff = diffStateEvents(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.byType.get('knowledge')).toBeDefined();
  });
});

describe('formatStateEventDiff', () => {
  it('formats no changes message', () => {
    const diff = diffStateEvents(
      createMinimalSnapshot(),
      createMinimalSnapshot(),
    );
    const output = formatStateEventDiff(diff);
    expect(output).toContain('No state changes');
  });

  it('formats changes with type labels', () => {
    const before = createMinimalSnapshot();
    const after = createMinimalSnapshot({
      memory: {
        core: [createMemoryEntry({ id: 'new-mem' })],
        knowledge: [],
      },
    });

    const diff = diffStateEvents(before, after);
    const output = formatStateEventDiff(diff);

    expect(output).toContain('State Changes');
    expect(output).toContain('Memories');
  });
});
