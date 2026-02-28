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
      expect(memory.ingestion.source_type).toBe('user_input');
      expect(memory.ingestion.source_id).toBe('user-1');
      expect(memory.ingestion.ingestion_timestamp).toBeDefined();
      expect(memory.ingestion.confidence_score).toBeGreaterThan(0);
      expect(memory.ingestion.quarantined).toBe(false);
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
      expect(memory.ingestion.source_type).toBe('system');
    });

    it('should reject entries with encoding artifacts', async () => {
      await expect(
        knowledge.storeMemory({
          namespace: testNamespace,
          content: 'bad\u0000content',
          source: {
            type: 'tool_output',
            identifier: 'terminal',
          },
        })
      ).rejects.toThrow('encoding artifacts');
    });

    it('should reject invalid structured JSON from tool output', async () => {
      await expect(
        knowledge.storeMemory({
          namespace: testNamespace,
          content: '{"status":',
          source: {
            type: 'tool_output',
            identifier: 'tool-run-42',
          },
          content_type: 'json',
        })
      ).rejects.toThrow('Invalid JSON payload');
    });

    it('should sanitize web scrape HTML to text and tag provenance', async () => {
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: '<html><body><script>alert(1)</script><p>Article body</p></body></html>',
        source: {
          type: 'web_scrape',
          identifier: 'https://example.com/article',
        },
      });

      expect(memory.content).toBe('Article body');
      expect(memory.content_type).toBe('text');
      expect(memory.ingestion.source_type).toBe('web_scrape');
      expect(memory.ingestion.source_id).toBe('https://example.com/article');
      expect(memory.ingestion.detected_format).toBe('html');
    });

    it('should truncate oversized text entries', async () => {
      const content = 'a'.repeat(16_050);
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content,
        source: {
          type: 'tool_output',
          identifier: 'terminal',
        },
      });

      expect(memory.content.length).toBe(16_000);
      expect(memory.ingestion.validation_notes.some(note => note.includes('truncated'))).toBe(true);
    });

    it('should quarantine low-confidence entries and exclude them from search', async () => {
      const suspicious = 'A'.repeat(220) + ' spam '.repeat(200);
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: suspicious,
        source: {
          type: 'web_scrape',
          identifier: 'https://spam.example',
        },
      });

      expect(memory.ingestion.quarantined).toBe(true);

      const primary = await knowledge.getMemory(memory.memory_id);
      expect(primary).toBeNull();

      const quarantined = await knowledge.listQuarantinedMemories(testNamespace);
      expect(quarantined.some(item => item.memory_id === memory.memory_id)).toBe(true);

      const searchResults = await knowledge.searchMemories({
        namespace: testNamespace,
        query: 'spam',
      });
      expect(searchResults.some(item => item.memory_id === memory.memory_id)).toBe(false);
    });

    it('should allow quarantined memory promotion', async () => {
      const suspicious = 'A'.repeat(220) + ' spam '.repeat(200);
      const memory = await knowledge.storeMemory({
        namespace: testNamespace,
        content: suspicious,
        source: {
          type: 'web_scrape',
          identifier: 'https://spam.example/post',
        },
      });

      const promoted = await knowledge.promoteQuarantinedMemory(memory.memory_id, 'reviewer-1');
      expect(promoted.ingestion.quarantined).toBe(false);

      const primary = await knowledge.getMemory(memory.memory_id);
      expect(primary).toBeTruthy();
      expect(primary?.provenance.some(p => p.reason?.includes('Promoted from quarantine'))).toBe(true);
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

    it('should filter out irrelevant results when a query is provided (min_semantic_similarity)', async () => {
      const results = await knowledge.searchMemories({
        namespace: testNamespace,
        query: 'dark mode',
        // leave min_semantic_similarity undefined to exercise the default guard
      });

      // The deployment memory should not be returned for a UI preference query.
      expect(results.some(r => r.content?.includes('production server'))).toBe(false);
    });

    it('should filter out stale results when max_age_seconds is set', async () => {
      const mem = await knowledge.storeMemory({
        namespace: testNamespace,
        content: 'Very old preference: use light mode',
        source: { type: 'user_input', identifier: 'user-1' },
        tags: ['preference', 'ui'],
        importance: 0.9,
        task_criticality: 0.3,
      });

      // Make it old
      const stored = await storage.getMemory(mem.memory_id);
      expect(stored).toBeTruthy();
      await storage.saveMemory({
        ...(stored as MemoryObject),
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const results = await knowledge.searchMemories({
        namespace: testNamespace,
        query: 'preference ui mode',
        max_age_seconds: 24 * 60 * 60, // 1 day
      });

      expect(results.some(r => r.memory_id === mem.memory_id)).toBe(false);
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

describe('Retrieval Explainability', () => {
  let storage: InMemoryCheckpointStorage;
  let knowledge: KnowledgeLane;
  const testNamespace: Namespace = {
    org_id: 'test-org',
    app_id: 'test-app',
    agent_id: 'test-agent',
  };

  beforeEach(async () => {
    storage = new InMemoryCheckpointStorage();
    knowledge = new KnowledgeLane(storage);

    // Create test memories
    await knowledge.storeMemory({
      namespace: testNamespace,
      content: 'User requested dark mode theme preference',
      source: { type: 'user_input', identifier: 'user-1' },
      tags: ['preference', 'ui', 'theme'],
      importance: 0.9,
      task_criticality: 0.3,
    });

    await knowledge.storeMemory({
      namespace: testNamespace,
      content: 'Deploy to production with zero downtime',
      source: { type: 'tool_output', identifier: 'ci-cd' },
      tags: ['deployment', 'production'],
      importance: 0.7,
      task_criticality: 0.95,
    });
  });

  describe('searchMemories with explain=true', () => {
    it('should include explanation when explain is true', async () => {
      const results = await knowledge.searchMemories({
        namespace: testNamespace,
        query: 'dark mode',
        explain: true,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].explanation).toBeDefined();
    });

    it('should not include explanation when explain is false or undefined', async () => {
      const resultsWithoutExplain = await knowledge.searchMemories({
        namespace: testNamespace,
        query: 'dark mode',
      });

      expect(resultsWithoutExplain[0].explanation).toBeUndefined();

      const resultsExplainFalse = await knowledge.searchMemories({
        namespace: testNamespace,
        query: 'dark mode',
        explain: false,
      });

      expect(resultsExplainFalse[0].explanation).toBeUndefined();
    });

    it('should include score breakdown in explanation', async () => {
      const results = await knowledge.searchMemories({
        namespace: testNamespace,
        query: 'deploy production',
        explain: true,
      });

      const explanation = results[0].explanation;
      expect(explanation).toBeDefined();
      expect(explanation?.relevance_score_breakdown).toBeDefined();
      expect(explanation?.relevance_score_breakdown.semantic_similarity).toBeGreaterThanOrEqual(0);
      expect(explanation?.relevance_score_breakdown.recency_decay).toBeGreaterThanOrEqual(0);
      expect(explanation?.relevance_score_breakdown.importance).toBeGreaterThanOrEqual(0);
      expect(explanation?.relevance_score_breakdown.task_criticality).toBeGreaterThanOrEqual(0);
    });

    it('should include source trace in explanation', async () => {
      const results = await knowledge.searchMemories({
        namespace: testNamespace,
        query: 'dark mode',
        explain: true,
      });

      const explanation = results[0].explanation;
      expect(explanation?.source_trace).toBeDefined();
      expect(explanation?.source_trace.source_type).toBe('user_input');
      expect(explanation?.source_trace.source_id).toBe('user-1');
      expect(explanation?.source_trace.ingestion_timestamp).toBeDefined();
    });

    it('should include policy path in explanation', async () => {
      const results = await knowledge.searchMemories({
        namespace: testNamespace,
        query: 'deploy',
        tags: ['deployment'],
        explain: true,
      });

      const explanation = results[0].explanation;
      expect(explanation?.policy_path).toBeDefined();
      expect(explanation?.policy_path.rules_applied.length).toBeGreaterThan(0);
      expect(explanation?.policy_path.filters_matched).toContain('tags: [deployment]');
    });

    it('should include human-readable summary', async () => {
      const results = await knowledge.searchMemories({
        namespace: testNamespace,
        query: 'dark mode theme',
        explain: true,
      });

      const explanation = results[0].explanation;
      expect(explanation?.summary).toBeDefined();
      expect(typeof explanation?.summary).toBe('string');
      expect(explanation?.summary.length).toBeGreaterThan(0);
    });

    it('should have final_score matching result score', async () => {
      const results = await knowledge.searchMemories({
        namespace: testNamespace,
        query: 'production deploy',
        explain: true,
      });

      const result = results[0];
      expect(result.explanation?.final_score).toBeCloseTo(result.score, 5);
    });
  });

  describe('explainRetrieval', () => {
    it('should return results with explanations', async () => {
      const results = await knowledge.explainRetrieval({
        namespace: testNamespace,
        query: 'dark mode preferences',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].explanation).toBeDefined();
      expect(results[0].explanation?.memory_id).toBe(results[0].memory_id);
    });

    it('should log audit entry for explain queries', async () => {
      await knowledge.explainRetrieval({
        namespace: testNamespace,
        query: 'test query',
      });

      const auditLog = await storage.getAuditLog(testNamespace);
      const explainEntry = auditLog.find(
        e => e.action === 'search' && e.metadata?.explain === true
      );
      expect(explainEntry).toBeDefined();
    });

    it('should document applied boosts in policy path', async () => {
      const results = await knowledge.explainRetrieval({
        namespace: testNamespace,
        query: 'production deploy zero',
      });

      const deployResult = results.find(r => r.content?.includes('production'));
      expect(deployResult).toBeDefined();
      expect(deployResult?.explanation?.policy_path.boosts_applied.length).toBeGreaterThan(0);
      // High task criticality should be noted
      expect(
        deployResult?.explanation?.policy_path.boosts_applied.some(
          b => b.includes('task criticality')
        )
      ).toBe(true);
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

    it('should be robust to invalid timestamps', () => {
      const score = calculateRecencyScore('not-a-date');
      expect(score).toBe(0);
    });

    it('should clamp future timestamps to 1.0 (clock skew)', () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      const score = calculateRecencyScore(future);
      expect(score).toBe(1);
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
        ingestion: {
          source_type: 'user_input',
          source_id: 'user',
          ingestion_timestamp: new Date().toISOString(),
          confidence_score: 1,
          detected_format: 'text',
          anomaly_flags: [],
          quarantined: false,
          validation_notes: [],
        },
        provenance: [],
        tags: [],
        importance: 1.0,
        task_criticality: 1.0,
        created_at: new Date().toISOString(),
        checkpoint_refs: [],
        version: 1,
        status: 'active',
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
        ingestion: {
          source_type: 'user_input',
          source_id: 'user',
          ingestion_timestamp: new Date().toISOString(),
          confidence_score: 1,
          detected_format: 'text',
          anomaly_flags: [],
          quarantined: false,
          validation_notes: [],
        },
        provenance: [],
        tags: [],
        importance: 1.0,
        task_criticality: 0.0,
        created_at: new Date().toISOString(),
        checkpoint_refs: [],
        version: 1,
        status: 'active',
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
