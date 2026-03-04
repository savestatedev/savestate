/**
 * Memory Lifecycle Controls Tests
 *
 * Issue #110: Memory Lifecycle Controls - mutation, correction, expiry, audit
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  KnowledgeLane,
  InMemoryCheckpointStorage,
  Namespace,
  MemoryObject,
} from '../index.js';

describe('Memory Lifecycle Controls (Issue #110)', () => {
  let storage: InMemoryCheckpointStorage;
  let knowledge: KnowledgeLane;
  const testNamespace: Namespace = {
    org_id: 'test-org',
    app_id: 'test-app',
    agent_id: 'test-agent',
    user_id: 'test-user',
  };

  beforeEach(() => {
    storage = new InMemoryCheckpointStorage();
    knowledge = new KnowledgeLane(storage);
  });

  describe('editMemory', () => {
    it('should edit memory content and create version history', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Original content',
        source: {
          type: 'user_input',
          identifier: 'user-1',
        },
        tags: ['original'],
        importance: 0.5,
      });

      expect(memory.version).toBe(1);

      const edited = await knowledge.editMemory(
        memory.memory_id,
        { content: 'Updated content', tags: ['edited'], importance: 0.8 },
        'editor-1',
        'Content was incorrect'
      );

      expect(edited.version).toBe(2);
      expect(edited.content).toBe('Updated content');
      expect(edited.tags).toEqual(['edited']);
      expect(edited.importance).toBe(0.8);
      expect(edited.previous_versions).toHaveLength(1);
      expect(edited.previous_versions![0].version).toBe(1);
      expect(edited.previous_versions![0].content).toBe('Original content');
      expect(edited.previous_versions![0].change_reason).toBe('Content was incorrect');

      // Check provenance
      const editEntry = edited.provenance.find(p => p.action === 'edited');
      expect(editEntry).toBeDefined();
      expect(editEntry?.actor_id).toBe('editor-1');
      expect(editEntry?.version).toBe(2);
    });

    it('should reject edits to deleted memories', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'To be deleted',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      await knowledge.deleteMemory(memory.memory_id, 'user-1', 'No longer needed');

      await expect(
        knowledge.editMemory(memory.memory_id, { content: 'New content' }, 'user-1')
      ).rejects.toThrow('deleted');
    });
  });

  describe('deleteMemory', () => {
    it('should soft delete memory with audit trail', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Memory to delete',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      await knowledge.deleteMemory(memory.memory_id, 'admin-1', 'Contains incorrect information');

      const deleted = await knowledge.getMemory(memory.memory_id);
      expect(deleted).toBeDefined();
      expect(deleted?.status).toBe('deleted');

      const deleteEntry = deleted?.provenance.find(p => p.action === 'deleted');
      expect(deleteEntry).toBeDefined();
      expect(deleteEntry?.actor_id).toBe('admin-1');
      expect(deleteEntry?.reason).toBe('Contains incorrect information');
    });

    it('should reject deletion of already deleted memory', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Memory to delete',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      await knowledge.deleteMemory(memory.memory_id, 'admin-1', 'First delete');

      await expect(
        knowledge.deleteMemory(memory.memory_id, 'admin-1', 'Second delete')
      ).rejects.toThrow('already deleted');
    });
  });

  describe('mergeMemories', () => {
    it('should merge multiple memories into one', async () => {
      const mem1 = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'User prefers dark mode',
        source: { type: 'user_input', identifier: 'user-1' },
        tags: ['preference', 'ui'],
        importance: 0.7,
      });

      const mem2 = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'User also likes blue accent colors',
        source: { type: 'user_input', identifier: 'user-1' },
        tags: ['preference', 'colors'],
        importance: 0.6,
      });

      const result = await knowledge.mergeMemories(
        [mem1.memory_id, mem2.memory_id],
        'User prefers dark mode with blue accent colors',
        'merger-1'
      );

      expect(result.merged_memory).toBeDefined();
      expect(result.merged_memory.content).toBe('User prefers dark mode with blue accent colors');
      expect(result.merged_ids).toHaveLength(2);

      // Check merged memory has combined tags
      expect(result.merged_memory.tags).toContain('preference');
      expect(result.merged_memory.tags).toContain('ui');
      expect(result.merged_memory.tags).toContain('colors');

      // Check provenance shows merge
      const mergeEntry = result.merged_memory.provenance.find(p => p.action === 'merged');
      expect(mergeEntry).toBeDefined();
      expect(mergeEntry?.merged_from).toContain(mem1.memory_id);
      expect(mergeEntry?.merged_from).toContain(mem2.memory_id);

      // Check original memories are deleted
      const deleted1 = await knowledge.getMemory(mem1.memory_id);
      const deleted2 = await knowledge.getMemory(mem2.memory_id);
      expect(deleted1?.status).toBe('deleted');
      expect(deleted2?.status).toBe('deleted');
    });

    it('should reject merge with fewer than 2 memories', async () => {
      const mem = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Single memory',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      await expect(
        knowledge.mergeMemories([mem.memory_id], 'Merged', 'merger-1')
      ).rejects.toThrow('At least 2');
    });

    it('should reject merge of memories from different namespaces', async () => {
      const mem1 = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Memory 1',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      const otherNamespace = { ...testNamespace, org_id: 'other-org' };
      const mem2 = await knowledge.storeMemory({
        namespace: otherNamespace,
        content: 'Memory 2',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      await expect(
        knowledge.mergeMemories([mem1.memory_id, mem2.memory_id], 'Merged', 'merger-1')
      ).rejects.toThrow('same namespace');
    });
  });

  describe('quarantineMemory', () => {
    it('should move memory to quarantine with audit', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Suspicious content',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      expect(memory.status).toBe('active');

      const quarantined = await knowledge.quarantineMemory(
        memory.memory_id,
        'reviewer-1',
        'Content needs review'
      );

      expect(quarantined.status).toBe('quarantined');
      expect(quarantined.ingestion.quarantined).toBe(true);

      const quarantineEntry = quarantined.provenance.find(p => p.action === 'quarantined');
      expect(quarantineEntry).toBeDefined();
      expect(quarantineEntry?.reason).toBe('Content needs review');
    });

    it('should reject quarantine of already quarantined memory', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Content',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      await knowledge.quarantineMemory(memory.memory_id, 'reviewer-1', 'Needs review');

      await expect(
        knowledge.quarantineMemory(memory.memory_id, 'reviewer-1', 'Double quarantine')
      ).rejects.toThrow('already quarantined');
    });
  });

  describe('rollbackMemory', () => {
    it('should rollback to a previous version', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Version 1 content',
        source: { type: 'user_input', identifier: 'user-1' },
        tags: ['v1'],
        importance: 0.5,
      });

      await knowledge.editMemory(
        memory.memory_id,
        { content: 'Version 2 content', tags: ['v2'], importance: 0.7 },
        'editor-1'
      );

      await knowledge.editMemory(
        memory.memory_id,
        { content: 'Version 3 content', tags: ['v3'], importance: 0.9 },
        'editor-1'
      );

      // Rollback to version 1
      const rolledBack = await knowledge.rollbackMemory(memory.memory_id, 1, 'admin-1');

      expect(rolledBack.content).toBe('Version 1 content');
      expect(rolledBack.tags).toEqual(['v1']);
      expect(rolledBack.importance).toBe(0.5);
      expect(rolledBack.version).toBe(4); // Version increments on rollback

      // Check provenance
      const rollbackEntry = rolledBack.provenance.find(p => p.action === 'rolled_back');
      expect(rollbackEntry).toBeDefined();
      expect(rollbackEntry?.reason).toContain('version 1');
    });

    it('should reject rollback to non-existent version', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Original',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      await knowledge.editMemory(memory.memory_id, { content: 'Updated' }, 'editor-1');

      await expect(
        knowledge.rollbackMemory(memory.memory_id, 99, 'admin-1')
      ).rejects.toThrow('Version 99 not found');
    });

    it('should reject rollback when no versions available', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Original',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      await expect(
        knowledge.rollbackMemory(memory.memory_id, 1, 'admin-1')
      ).rejects.toThrow('no previous versions');
    });
  });

  describe('expireMemories', () => {
    it('should expire memories based on ttl_seconds', async () => {
      // Create a memory with short TTL
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Short-lived memory',
        source: { type: 'user_input', identifier: 'user-1' },
        ttl_seconds: 1, // 1 second TTL
      });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      const result = await knowledge.expireMemories(testNamespace);

      expect(result.expired_count).toBe(1);
      expect(result.expired_ids).toContain(memory.memory_id);

      // Check memory is marked as deleted
      const expired = await knowledge.getMemory(memory.memory_id);
      expect(expired?.status).toBe('deleted');

      // Check provenance
      const expireEntry = expired?.provenance.find(p => p.action === 'expired');
      expect(expireEntry).toBeDefined();
    });

    it('should expire memories based on expires_at', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Memory with expiry',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      // Manually set expires_at to the past
      const stored = await storage.getMemory(memory.memory_id);
      await storage.saveMemory({
        ...stored!,
        expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      const result = await knowledge.expireMemories(testNamespace);

      expect(result.expired_count).toBe(1);
      expect(result.expired_ids).toContain(memory.memory_id);
    });

    it('should not expire memories without TTL or expires_at', async () => {
      await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Permanent memory',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      const result = await knowledge.expireMemories(testNamespace);

      expect(result.expired_count).toBe(0);
    });
  });

  describe('memoryAuditLog', () => {
    it('should return complete provenance history', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Original',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      await knowledge.editMemory(memory.memory_id, { content: 'Edited' }, 'editor-1', 'Fixed typo');
      await knowledge.recordAccess(memory.memory_id, 'checkpoint-1', 'agent-1');

      const log = await knowledge.memoryAuditLog(memory.memory_id);

      expect(log.length).toBeGreaterThanOrEqual(3);
      expect(log.some(e => e.action === 'created')).toBe(true);
      expect(log.some(e => e.action === 'edited')).toBe(true);
      expect(log.some(e => e.action === 'accessed')).toBe(true);
    });

    it('should return empty array for non-existent memory', async () => {
      const log = await knowledge.memoryAuditLog('non-existent-id');
      expect(log).toEqual([]);
    });
  });

  describe('listMemories', () => {
    it('should list memories with status filter', async () => {
      const active = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Active memory',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      const toDelete = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'To be deleted',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      await knowledge.deleteMemory(toDelete.memory_id, 'admin-1', 'Cleanup');

      const activeOnly = await knowledge.listMemories(testNamespace, { status: 'active' });
      expect(activeOnly).toHaveLength(1);
      expect(activeOnly[0].memory_id).toBe(active.memory_id);

      const deletedOnly = await knowledge.listMemories(testNamespace, { status: 'deleted' });
      expect(deletedOnly).toHaveLength(1);
      expect(deletedOnly[0].memory_id).toBe(toDelete.memory_id);
    });

    it('should exclude deleted memories by default', async () => {
      await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Active memory',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      const toDelete = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'To be deleted',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      await knowledge.deleteMemory(toDelete.memory_id, 'admin-1', 'Cleanup');

      const memories = await knowledge.listMemories(testNamespace);
      expect(memories).toHaveLength(1);
    });
  });

  describe('version tracking', () => {
    it('should initialize new memories with version 1', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'New memory',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      expect(memory.version).toBe(1);
      expect(memory.previous_versions).toEqual([]);
      expect(memory.status).toBe('active');
    });

    it('should track full version history through multiple edits', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'v1',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      await knowledge.editMemory(memory.memory_id, { content: 'v2' }, 'e1');
      await knowledge.editMemory(memory.memory_id, { content: 'v3' }, 'e2');
      const final = await knowledge.editMemory(memory.memory_id, { content: 'v4' }, 'e3');

      expect(final.version).toBe(4);
      expect(final.previous_versions).toHaveLength(3);
      expect(final.previous_versions![0].content).toBe('v1');
      expect(final.previous_versions![1].content).toBe('v2');
      expect(final.previous_versions![2].content).toBe('v3');
    });
  });
});
