/**
 * Checkpoint Ledger Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CheckpointLedger,
  computeCheckpointHash,
  verifyCheckpointIntegrity,
  verifyChainIntegrity,
  InMemoryCheckpointStorage,
  Namespace,
  Checkpoint,
} from '../index.js';

describe('CheckpointLedger', () => {
  let storage: InMemoryCheckpointStorage;
  let ledger: CheckpointLedger;
  const testNamespace: Namespace = {
    org_id: 'test-org',
    app_id: 'test-app',
    agent_id: 'test-agent',
    user_id: 'test-user',
  };

  beforeEach(() => {
    storage = new InMemoryCheckpointStorage();
    ledger = new CheckpointLedger(storage);
  });

  describe('createCheckpoint', () => {
    it('should create a genesis checkpoint with null parent', async () => {
      const checkpoint = await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
      });

      expect(checkpoint.checkpoint_id).toBeDefined();
      expect(checkpoint.parent_checkpoint_id).toBeNull();
      expect(checkpoint.step_index).toBe(0);
      expect(checkpoint.run_id).toBe('run-1');
      expect(checkpoint.state_hash).toBeDefined();
    });

    it('should link subsequent checkpoints to parent', async () => {
      const cp1 = await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
      });

      const cp2 = await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
      });

      expect(cp2.parent_checkpoint_id).toBe(cp1.checkpoint_id);
      expect(cp2.step_index).toBe(1);
    });

    it('should increment step index correctly', async () => {
      const checkpoints: Checkpoint[] = [];
      
      for (let i = 0; i < 5; i++) {
        const cp = await ledger.createCheckpoint({
          namespace: testNamespace,
          run_id: 'run-1',
          writer_id: 'agent-1',
        });
        checkpoints.push(cp);
      }

      checkpoints.forEach((cp, i) => {
        expect(cp.step_index).toBe(i);
      });
    });

    it('should preserve goal stack and tool state', async () => {
      const checkpoint = await ledger.createCheckpoint({
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
        tool_state: {
          browser: { url: 'https://example.com' },
        },
      });

      expect(checkpoint.goal_stack).toHaveLength(1);
      expect(checkpoint.goal_stack[0].description).toBe('Test goal');
      expect(checkpoint.tool_state.browser).toEqual({ url: 'https://example.com' });
    });
  });

  describe('getCheckpoint', () => {
    it('should retrieve checkpoint by ID', async () => {
      const created = await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
      });

      const retrieved = await ledger.getCheckpoint(created.checkpoint_id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.checkpoint_id).toBe(created.checkpoint_id);
    });

    it('should return null for non-existent checkpoint', async () => {
      const result = await ledger.getCheckpoint('non-existent-id');
      expect(result).toBeNull();
    });

    it('should verify integrity when requested', async () => {
      const checkpoint = await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
      });

      const retrieved = await ledger.getCheckpoint(checkpoint.checkpoint_id, { verify: true });
      expect(retrieved).toBeDefined();
    });
  });

  describe('getLatestCheckpoint', () => {
    it('should return the latest checkpoint for a namespace', async () => {
      await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
      });

      const latest = await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
      });

      const result = await ledger.getLatestCheckpoint(testNamespace);
      expect(result?.checkpoint_id).toBe(latest.checkpoint_id);
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

      const result = await ledger.getLatestCheckpoint(testNamespace, 'run-2');
      expect(result?.checkpoint_id).toBe(run2Checkpoint.checkpoint_id);
    });

    it('should return null for empty namespace', async () => {
      const result = await ledger.getLatestCheckpoint(testNamespace);
      expect(result).toBeNull();
    });
  });

  describe('getCheckpointChain', () => {
    it('should return full chain from checkpoint to genesis', async () => {
      const checkpoints: Checkpoint[] = [];
      
      for (let i = 0; i < 3; i++) {
        const cp = await ledger.createCheckpoint({
          namespace: testNamespace,
          run_id: 'run-1',
          writer_id: 'agent-1',
        });
        checkpoints.push(cp);
      }

      const chain = await ledger.getCheckpointChain(checkpoints[2].checkpoint_id);
      
      expect(chain).toHaveLength(3);
      expect(chain[0].checkpoint_id).toBe(checkpoints[2].checkpoint_id);
      expect(chain[1].checkpoint_id).toBe(checkpoints[1].checkpoint_id);
      expect(chain[2].checkpoint_id).toBe(checkpoints[0].checkpoint_id);
    });
  });

  describe('forkRun', () => {
    it('should create new run forked from existing checkpoint', async () => {
      const original = await ledger.createCheckpoint({
        namespace: testNamespace,
        run_id: 'run-1',
        writer_id: 'agent-1',
        goal_stack: [
          {
            id: 'goal-1',
            description: 'Forked goal',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });

      const forked = await ledger.forkRun(
        original.checkpoint_id,
        'run-2',
        'agent-1'
      );

      expect(forked.run_id).toBe('run-2');
      expect(forked.parent_checkpoint_id).toBe(original.checkpoint_id);
      expect(forked.step_index).toBe(0);
      expect(forked.goal_stack).toHaveLength(1);
      expect(forked.goal_stack[0].description).toBe('Forked goal');
    });
  });

  describe('verifyChain', () => {
    it('should verify valid chain', async () => {
      for (let i = 0; i < 3; i++) {
        await ledger.createCheckpoint({
          namespace: testNamespace,
          run_id: 'run-1',
          writer_id: 'agent-1',
        });
      }

      const latest = await ledger.getLatestCheckpoint(testNamespace);
      const result = await ledger.verifyChain(latest!.checkpoint_id);

      expect(result.valid).toBe(true);
    });
  });
});

describe('Integrity Functions', () => {
  describe('computeCheckpointHash', () => {
    it('should produce deterministic hash', () => {
      const checkpoint: Omit<Checkpoint, 'state_hash'> = {
        checkpoint_id: 'test-id',
        parent_checkpoint_id: null,
        namespace: {
          org_id: 'org',
          app_id: 'app',
          agent_id: 'agent',
        },
        run_id: 'run-1',
        step_index: 0,
        goal_stack: [],
        pending_actions: [],
        tool_state: {},
        policy_flags: [],
        unresolved_tasks: [],
        memory_refs: [],
        created_at: '2024-01-01T00:00:00.000Z',
        writer_id: 'writer',
        schema_version: 1,
      };

      const hash1 = computeCheckpointHash(checkpoint);
      const hash2 = computeCheckpointHash(checkpoint);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce different hash for different content', () => {
      const base: Omit<Checkpoint, 'state_hash'> = {
        checkpoint_id: 'test-id',
        parent_checkpoint_id: null,
        namespace: {
          org_id: 'org',
          app_id: 'app',
          agent_id: 'agent',
        },
        run_id: 'run-1',
        step_index: 0,
        goal_stack: [],
        pending_actions: [],
        tool_state: {},
        policy_flags: [],
        unresolved_tasks: [],
        memory_refs: [],
        created_at: '2024-01-01T00:00:00.000Z',
        writer_id: 'writer',
        schema_version: 1,
      };

      const modified = { ...base, step_index: 1 };

      const hash1 = computeCheckpointHash(base);
      const hash2 = computeCheckpointHash(modified);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyCheckpointIntegrity', () => {
    it('should return true for valid checkpoint', () => {
      const checkpointWithoutHash: Omit<Checkpoint, 'state_hash'> = {
        checkpoint_id: 'test-id',
        parent_checkpoint_id: null,
        namespace: {
          org_id: 'org',
          app_id: 'app',
          agent_id: 'agent',
        },
        run_id: 'run-1',
        step_index: 0,
        goal_stack: [],
        pending_actions: [],
        tool_state: {},
        policy_flags: [],
        unresolved_tasks: [],
        memory_refs: [],
        created_at: '2024-01-01T00:00:00.000Z',
        writer_id: 'writer',
        schema_version: 1,
      };

      const checkpoint: Checkpoint = {
        ...checkpointWithoutHash,
        state_hash: computeCheckpointHash(checkpointWithoutHash),
      };

      expect(verifyCheckpointIntegrity(checkpoint)).toBe(true);
    });

    it('should return false for tampered checkpoint', () => {
      const checkpointWithoutHash: Omit<Checkpoint, 'state_hash'> = {
        checkpoint_id: 'test-id',
        parent_checkpoint_id: null,
        namespace: {
          org_id: 'org',
          app_id: 'app',
          agent_id: 'agent',
        },
        run_id: 'run-1',
        step_index: 0,
        goal_stack: [],
        pending_actions: [],
        tool_state: {},
        policy_flags: [],
        unresolved_tasks: [],
        memory_refs: [],
        created_at: '2024-01-01T00:00:00.000Z',
        writer_id: 'writer',
        schema_version: 1,
      };

      const checkpoint: Checkpoint = {
        ...checkpointWithoutHash,
        state_hash: computeCheckpointHash(checkpointWithoutHash),
      };

      // Tamper with checkpoint
      checkpoint.step_index = 999;

      expect(verifyCheckpointIntegrity(checkpoint)).toBe(false);
    });
  });
});
