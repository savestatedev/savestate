/**
 * Save-Recall Integrity Tests (Issue #126)
 *
 * Regression tests for the P0 bug where memory save confirmations
 * were followed by missing recall. Root causes:
 * 1. searchMemories returned deleted/quarantined memories (no status filter)
 * 2. getMemory didn't check quarantine store, so checkpoint refs to
 *    quarantined memories silently disappeared on restore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RestoreService,
  CheckpointLedger,
  KnowledgeLane,
  InMemoryCheckpointStorage,
  Namespace,
} from '../index.js';

describe('Save-Recall Integrity (Issue #126)', () => {
  let storage: InMemoryCheckpointStorage;
  let restoreService: RestoreService;
  let ledger: CheckpointLedger;
  let knowledge: KnowledgeLane;

  const ns: Namespace = {
    org_id: 'test-org',
    app_id: 'test-app',
    agent_id: 'test-agent',
    user_id: 'test-user',
  };

  beforeEach(() => {
    storage = new InMemoryCheckpointStorage();
    restoreService = new RestoreService(storage);
    ledger = new CheckpointLedger(storage);
    knowledge = new KnowledgeLane(storage);
  });

  it('should recall a memory that was saved and referenced in checkpoint', async () => {
    // Save memory (confirmed)
    const mem = await knowledge.storeMemory({
      namespace: ns,
      content: 'User prefers dark mode',
      source: { type: 'user_input', identifier: 'user-1' },
      importance: 0.9,
    });

    // Create checkpoint referencing memory
    await ledger.createCheckpoint({
      namespace: ns,
      run_id: 'run-1',
      writer_id: 'agent-1',
      memory_refs: [mem.memory_id],
    });

    // Restore and verify memory is present
    const pack = await restoreService.restore({ namespace: ns });
    expect(pack.memories).toHaveLength(1);
    expect(pack.memories[0].memory_id).toBe(mem.memory_id);
    expect(pack.memories[0].content).toBe('User prefers dark mode');
  });

  it('should NOT return deleted memories in search results', async () => {
    const mem = await knowledge.storeMemory({
      namespace: ns,
      content: 'Sensitive config value ABC123',
      source: { type: 'user_input', identifier: 'user-1' },
      tags: ['config'],
      importance: 0.8,
    });

    // Soft-delete the memory
    await knowledge.deleteMemory(mem.memory_id, 'user-1', 'User requested deletion');

    // Search should NOT return the deleted memory
    const results = await knowledge.searchMemories({
      namespace: ns,
      tags: ['config'],
    });

    expect(results).toHaveLength(0);
  });

  it('should NOT return deleted memories in text search', async () => {
    const mem = await knowledge.storeMemory({
      namespace: ns,
      content: 'The secret API key is XYZ789',
      source: { type: 'user_input', identifier: 'user-1' },
      importance: 0.9,
    });

    await knowledge.deleteMemory(mem.memory_id, 'user-1', 'Deleted');

    const results = await knowledge.searchMemories({
      namespace: ns,
      query: 'secret API key',
    });

    expect(results).toHaveLength(0);
  });

  it('should still find quarantined memory by ID (for restore)', async () => {
    const mem = await knowledge.storeMemory({
      namespace: ns,
      content: 'Important context saved before quarantine',
      source: { type: 'user_input', identifier: 'user-1' },
      importance: 0.9,
    });

    // Quarantine the memory
    await knowledge.quarantineMemory(mem.memory_id, 'sentinel', 'Suspicious content');

    // getMemory should still find it (needed for restore from checkpoint refs)
    const found = await knowledge.getMemory(mem.memory_id);
    expect(found).not.toBeNull();
    expect(found!.content).toBe('Important context saved before quarantine');
    expect(found!.status).toBe('quarantined');
  });

  it('should restore checkpoint memories even if some were quarantined', async () => {
    const mem1 = await knowledge.storeMemory({
      namespace: ns,
      content: 'Memory A: still active',
      source: { type: 'user_input', identifier: 'user-1' },
      importance: 0.9,
    });

    const mem2 = await knowledge.storeMemory({
      namespace: ns,
      content: 'Memory B: will be quarantined',
      source: { type: 'user_input', identifier: 'user-1' },
      importance: 0.8,
    });

    // Checkpoint references both memories
    await ledger.createCheckpoint({
      namespace: ns,
      run_id: 'run-1',
      writer_id: 'agent-1',
      memory_refs: [mem1.memory_id, mem2.memory_id],
    });

    // Quarantine one memory after checkpoint was created
    await knowledge.quarantineMemory(mem2.memory_id, 'sentinel', 'Review needed');

    // Restore should still include BOTH memories
    const pack = await restoreService.restore({ namespace: ns });
    expect(pack.memories).toHaveLength(2);
    const ids = pack.memories.map(m => m.memory_id);
    expect(ids).toContain(mem1.memory_id);
    expect(ids).toContain(mem2.memory_id);
  });

  it('should NOT return quarantined memories in search results', async () => {
    await knowledge.storeMemory({
      namespace: ns,
      content: 'Clean memory',
      source: { type: 'user_input', identifier: 'user-1' },
      tags: ['preference'],
      importance: 0.8,
    });

    const suspicious = await knowledge.storeMemory({
      namespace: ns,
      content: 'Suspicious memory',
      source: { type: 'user_input', identifier: 'user-1' },
      tags: ['preference'],
      importance: 0.8,
    });

    await knowledge.quarantineMemory(suspicious.memory_id, 'sentinel', 'Bad content');

    const results = await knowledge.searchMemories({
      namespace: ns,
      tags: ['preference'],
    });

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Clean memory');
  });

  it('end-to-end: save, confirm, then recall in new session', async () => {
    // Simulate: user saves multiple memories across a session
    const memories = [];
    for (let i = 0; i < 5; i++) {
      const mem = await knowledge.storeMemory({
        namespace: ns,
        content: `User preference ${i}: value-${i}`,
        source: { type: 'user_input', identifier: 'user-1' },
        tags: ['preference'],
        importance: 0.7 + i * 0.05,
      });
      memories.push(mem);
    }

    // Checkpoint at end of session
    await ledger.createCheckpoint({
      namespace: ns,
      run_id: 'session-1',
      writer_id: 'agent-1',
      memory_refs: memories.map(m => m.memory_id),
    });

    // New session: restore
    const pack = await restoreService.restore({ namespace: ns });
    expect(pack.memories).toHaveLength(5);

    // Also verify search works
    const searchResults = await knowledge.searchMemories({
      namespace: ns,
      query: 'User preference',
      limit: 10,
    });
    expect(searchResults.length).toBe(5);

    // All content should be recallable
    for (let i = 0; i < 5; i++) {
      const found = searchResults.find(r => r.content?.includes(`value-${i}`));
      expect(found).toBeDefined();
    }
  });
});
