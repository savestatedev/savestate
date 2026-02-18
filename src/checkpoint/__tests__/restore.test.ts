/**
 * Restore Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RestoreService,
  CheckpointLedger,
  KnowledgeLane,
  InMemoryCheckpointStorage,
  Namespace,
} from '../index.js';

describe('RestoreService', () => {
  let storage: InMemoryCheckpointStorage;
  let restoreService: RestoreService;
  let ledger: CheckpointLedger;
  let knowledge: KnowledgeLane;
  
  const testNamespace: Namespace = {
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

  describe('restore', () => {
    it('should restore from latest checkpoint by default', async () => {
      // Create checkpoints
      await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
      });

      const latest = await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
        goal_stack: [
          {
            id: 'goal-1',
            description: 'Test goal',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });

      const resumePack = await restoreService.restore({
        namespace: testNamespace,
      });

      expect(resumePack.checkpoint.checkpoint_id).toBe(latest.checkpoint_id);
      expect(resumePack.checkpoint.goal_stack).toHaveLength(1);
      expect(resumePack.restored_at).toBeDefined();
    });

    it('should restore from specific checkpoint when ID provided', async () => {
      const first = await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
        policy_flags: ['first'],
      });

      await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
        policy_flags: ['second'],
      });

      const resumePack = await restoreService.restore({
        namespace: testNamespace,
        checkpoint_id: first.checkpoint_id,
      });

      expect(resumePack.checkpoint.checkpoint_id).toBe(first.checkpoint_id);
      expect(resumePack.checkpoint.policy_flags).toContain('first');
    });

    it('should filter by run_id when provided', async () => {
      await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
      });

      const run2Checkpoint = await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-2',
        writer_id: 'agent-1',
      });

      const resumePack = await restoreService.restore({
        namespace: testNamespace,
        run_id: 'run-2',
      });

      expect(resumePack.checkpoint.checkpoint_id).toBe(run2Checkpoint.checkpoint_id);
    });

    it('should throw error when no checkpoint found', async () => {
      await expect(
        restoreService.restore({
          namespace: testNamespace,
        })
      ).rejects.toThrow('No checkpoint found');
    });

    it('should include referenced memories', async () => {
      // Create memory
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Important context',
        source: { type: 'user_input', identifier: 'user-1' },
        importance: 0.9,
      });

      // Create checkpoint with memory reference
      await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
        memory_refs: [memory.memory_id],
      });

      const resumePack = await restoreService.restore({
        namespace: testNamespace,
      });

      expect(resumePack.memories).toHaveLength(1);
      expect(resumePack.memories[0].memory_id).toBe(memory.memory_id);
      expect(resumePack.memories[0].score).toBe(1.0); // Max score for direct refs
    });

    it('should search for additional memories when query provided', async () => {
      // Create memories
      await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'User prefers TypeScript',
        source: { type: 'user_input', identifier: 'user-1' },
        tags: ['preference'],
        importance: 0.8,
      });

      await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Deploy to staging first',
        source: { type: 'tool_output', identifier: 'terminal' },
        tags: ['deployment'],
        importance: 0.7,
      });

      // Create checkpoint without memory refs
      await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
      });

      const resumePack = await restoreService.restore({
        namespace: testNamespace,
        memory_query: {
          tags: ['preference'],
        },
        max_memories: 5,
      });

      expect(resumePack.memories.length).toBeGreaterThan(0);
      expect(resumePack.memories[0].tags).toContain('preference');
    });

    it('should include rationale in resume pack', async () => {
      await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
        pending_actions: [
          {
            id: 'action-1',
            type: 'api_call',
            payload: {},
            status: 'pending',
            created_at: new Date().toISOString(),
          },
        ],
      });

      const resumePack = await restoreService.restore({
        namespace: testNamespace,
      });

      expect(resumePack.rationale).toBeDefined();
      expect(resumePack.rationale.checkpoint_selection).toBeDefined();
      expect(resumePack.rationale.warnings.length).toBeGreaterThan(0);
      expect(resumePack.rationale.warnings.some(w => w.includes('pending actions'))).toBe(true);
    });

    it('should include unresolved tasks from checkpoint', async () => {
      await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
        unresolved_tasks: [
          {
            id: 'task-1',
            description: 'Review PR',
            status: 'pending',
            priority: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });

      const resumePack = await restoreService.restore({
        namespace: testNamespace,
      });

      expect(resumePack.unresolved_tasks).toHaveLength(1);
      expect(resumePack.unresolved_tasks[0].description).toBe('Review PR');
    });
  });

  describe('explainRestore', () => {
    it('should return checkpoints and memory citations for a run', async () => {
      // Create memory
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Cited memory',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      // Create checkpoints with memory refs
      await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
        memory_refs: [memory.memory_id],
      });

      await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
        memory_refs: [memory.memory_id],
      });

      const explanation = await restoreService.explainRestore('run-1', testNamespace);

      expect(explanation.checkpoints).toHaveLength(2);
      expect(explanation.memory_citations).toHaveLength(2);
      expect(explanation.memory_citations[0].memory_id).toBe(memory.memory_id);
    });
  });
});

describe('Namespace Isolation', () => {
  let storage: InMemoryCheckpointStorage;
  let restoreService: RestoreService;
  let ledger: CheckpointLedger;

  const namespace1: Namespace = {
    org_id: 'org-1',
    app_id: 'app-1',
    agent_id: 'agent-1',
  };

  const namespace2: Namespace = {
    org_id: 'org-2',
    app_id: 'app-2',
    agent_id: 'agent-2',
  };

  beforeEach(() => {
    storage = new InMemoryCheckpointStorage();
    restoreService = new RestoreService(storage);
    ledger = new CheckpointLedger(storage);
  });

  it('should not access checkpoints from other namespaces', async () => {
    // Create checkpoint in namespace 1
    await ledger.createCheckpoint({
      namespace: namespace1,
      run_id: 'run-1',
      writer_id: 'agent-1',
    });

    // Try to restore from namespace 2
    await expect(
      restoreService.restore({
        namespace: namespace2,
      })
    ).rejects.toThrow('No checkpoint found');
  });

  it('should keep checkpoints isolated by namespace', async () => {
    await ledger.createCheckpoint({
      namespace: namespace1,
      run_id: 'run-1',
      writer_id: 'agent-1',
      policy_flags: ['namespace-1'],
    });

    await ledger.createCheckpoint({
      namespace: namespace2,
      run_id: 'run-1',
      writer_id: 'agent-2',
      policy_flags: ['namespace-2'],
    });

    const resumePack1 = await restoreService.restore({ namespace: namespace1 });
    const resumePack2 = await restoreService.restore({ namespace: namespace2 });

    expect(resumePack1.checkpoint.policy_flags).toContain('namespace-1');
    expect(resumePack2.checkpoint.policy_flags).toContain('namespace-2');
  });
});
