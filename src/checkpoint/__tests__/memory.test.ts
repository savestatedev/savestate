/**
 * Knowledge Lane / Memory Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  KnowledgeLane,
  InMemoryCheckpointStorage,
  Namespace,
  calculateRecencyScore,
  calculateMemoryScore,
  DEFAULT_RANKING_WEIGHTS,
  MemoryObject,
} from '../index.js';

describe('KnowledgeLane', () => {
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

  describe('storeMemory', () => {
    it('should store memory with provenance', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Test memory content',
        source: {
          type: 'user_input',
          identifier: 'user-1',
        },
        tags: ['test', 'important'],
        importance: 0.8,
      });

      expect(memory.memory_id).toBeDefined();
      expect(memory.content).toBe('Test memory content');
      expect(memory.tags).toContain('test');
      expect(memory.importance).toBe(0.8);
      expect(memory.provenance).toHaveLength(1);
      expect(memory.provenance[0].action).toBe('created');
    });

    it('should use default values for optional fields', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Minimal memory',
        source: {
          type: 'system',
          identifier: 'system',
        },
      });

      expect(memory.content_type).toBe('text');
      expect(memory.importance).toBe(0.5);
      expect(memory.task_criticality).toBe(0.5);
      expect(memory.tags).toEqual([]);
    });
  });

  describe('getMemory', () => {
    it('should retrieve memory by ID', async () => {
      const created = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Retrievable memory',
        source: {
          type: 'user_input',
          identifier: 'user-1',
        },
      });

      const retrieved = await knowledge.getMemory(created.memory_id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('Retrievable memory');
    });

    it('should return null for non-existent memory', async () => {
      const result = await knowledge.getMemory('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('searchMemories', () => {
    beforeEach(async () => {
      // Create test memories
      await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'The user prefers dark mode for all applications',
        source: { type: 'user_input', identifier: 'user-1' },
        tags: ['preference', 'ui'],
        importance: 0.9,
        task_criticality: 0.3,
      });

      await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Deploy the application to production server',
        source: { type: 'tool_output', identifier: 'terminal' },
        tags: ['task', 'deployment'],
        importance: 0.7,
        task_criticality: 0.9,
      });

      await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Remember to check the weather before outdoor activities',
        source: { type: 'agent_inference', identifier: 'agent-1' },
        tags: ['reminder', 'weather'],
        importance: 0.4,
        task_criticality: 0.2,
      });
    });

    it('should search by text query', async () => {
      const results = await knowledge.searchMemories({
        namespace: testNamespace,
        query: 'user preferences dark mode',
      });

      expect(results.length).toBeGreaterThan(0);
      // The query should find the dark mode preference memory
      const darkModeResult = results.find(r => r.content?.includes('dark mode'));
      expect(darkModeResult).toBeDefined();
    });

    it('should filter by tags', async () => {
      const results = await knowledge.searchMemories({
        namespace: testNamespace,
        tags: ['deployment'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('production server');
    });

    it('should filter by source type', async () => {
      const results = await knowledge.searchMemories({
        namespace: testNamespace,
        source_types: ['agent_inference'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('weather');
    });

    it('should filter by minimum importance', async () => {
      const results = await knowledge.searchMemories({
        namespace: testNamespace,
        min_importance: 0.8,
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('dark mode');
    });

    it('should respect limit', async () => {
      const results = await knowledge.searchMemories({
        namespace: testNamespace,
        limit: 2,
      });

      expect(results).toHaveLength(2);
    });

    it('should include score components', async () => {
      const results = await knowledge.searchMemories({
        namespace: testNamespace,
        query: 'deploy',
      });

      expect(results[0].score_components).toBeDefined();
      expect(results[0].score_components.task_criticality).toBeGreaterThan(0);
    });

    it('should flag very old memories as stale', async () => {
      const mem = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Old but relevant: deploy to prod',
        source: { type: 'user_input', identifier: 'user-1' },
        tags: ['deployment'],
        importance: 0.9,
        task_criticality: 0.9,
      });

      // Make it old
      const stored = await storage.getMemory(mem.memory_id);
      expect(stored).toBeTruthy();
      await storage.saveMemory({
        ...(stored as MemoryObject),
        created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const results = await knowledge.searchMemories({
        namespace: testNamespace,
        query: 'deploy prod',
      });

      const result = results.find(r => r.memory_id === mem.memory_id);
      expect(result).toBeTruthy();
      expect(result?.is_stale).toBe(true);
      expect((result?.age_days ?? 0)).toBeGreaterThanOrEqual(90);
    });
  });

  describe('recordAccess', () => {
    it('should update last_accessed_at', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Accessed memory',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      await knowledge.recordAccess(memory.memory_id, 'checkpoint-1', 'agent-1');

      const updated = await knowledge.getMemory(memory.memory_id);
      expect(updated?.last_accessed_at).toBeDefined();
      expect(updated?.checkpoint_refs).toContain('checkpoint-1');
    });
  });

  describe('invalidateMemory', () => {
    it('should mark memory as invalidated', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Memory to invalidate',
        source: { type: 'user_input', identifier: 'user-1' },
      });

      await knowledge.invalidateMemory(
        memory.memory_id,
        'agent-1',
        'Information is outdated'
      );

      const updated = await knowledge.getMemory(memory.memory_id);
      expect(updated?.ttl_seconds).toBe(0);
      expect(updated?.provenance.some(p => p.action === 'invalidated')).toBe(true);
    });
  });
});

describe('Scoring Functions', () => {
  describe('calculateRecencyScore', () => {
    it('should return 1.0 for very recent memory', () => {
      const now = new Date().toISOString();
      const score = calculateRecencyScore(now);
      expect(score).toBeCloseTo(1.0, 1);
    });

    it('should decay over time', () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const score = calculateRecencyScore(oneWeekAgo);
      
      // After one half-life (7 days), score should be ~0.5
      expect(score).toBeCloseTo(0.5, 1);
    });

    it('should treat last_accessed_at as a small boost (not full freshness)', () => {
      const oldCreated = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const recentAccess = new Date().toISOString();

      const scoreWithoutAccess = calculateRecencyScore(oldCreated);
      const scoreWithAccess = calculateRecencyScore(oldCreated, recentAccess);

      expect(scoreWithAccess).toBeGreaterThan(scoreWithoutAccess);
      // Access should not fully override true age.
      expect(scoreWithAccess).toBeLessThan(0.6);
    });
  });

  describe('calculateMemoryScore', () => {
    it('should weight components according to formula', () => {
      const memory: MemoryObject = {
        memory_id: 'test',
        namespace: { org_id: 'org', app_id: 'app', agent_id: 'agent' },
        content: 'Test',
        content_type: 'text',
        source: { type: 'user_input', identifier: 'user', timestamp: new Date().toISOString() },
        provenance: [],
        tags: [],
        importance: 1.0,
        task_criticality: 1.0,
        created_at: new Date().toISOString(),
        checkpoint_refs: [],
      };

      const { score, components } = calculateMemoryScore(memory, 1.0);

      // With all factors at 1.0 and default weights:
      // 0.45 * 1.0 + 0.25 * 1.0 + 0.20 * 1.0 + 0.10 * ~1.0 ≈ 1.0
      expect(score).toBeCloseTo(1.0, 1);
      expect(components.task_criticality).toBeCloseTo(0.45, 2);
      expect(components.semantic_similarity).toBeCloseTo(0.25, 2);
      expect(components.importance).toBeCloseTo(0.20, 2);
    });

    it('should allow custom weights', () => {
      const memory: MemoryObject = {
        memory_id: 'test',
        namespace: { org_id: 'org', app_id: 'app', agent_id: 'agent' },
        content: 'Test',
        content_type: 'text',
        source: { type: 'user_input', identifier: 'user', timestamp: new Date().toISOString() },
        provenance: [],
        tags: [],
        importance: 1.0,
        task_criticality: 0.0,
        created_at: new Date().toISOString(),
        checkpoint_refs: [],
      };

      // Custom weights: only importance matters
      const customWeights = {
        task_criticality: 0,
        semantic_similarity: 0,
        importance: 1.0,
        recency_decay: 0,
      };

      const { score } = calculateMemoryScore(memory, 1.0, customWeights);

      expect(score).toBeCloseTo(1.0, 1);
    });
  });
});
