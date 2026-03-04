/**
 * SLO Module Tests
 *
 * Tests for memory freshness SLOs, staleness detection,
 * cross-session tracking, and drift detection.
 * Issue #108.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateStalenessScore,
  computeStalenessMetrics,
  DEFAULT_FRESHNESS_SLO,
  createRecallFailure,
  validateSLOConfig,
  mergeSLOConfig,
  formatDuration,
  parseDuration,
  DEFAULT_SLO_CONFIG,
} from '../index.js';
import { InMemoryCheckpointStorage } from '../../checkpoint/storage/memory.js';
import {
  KnowledgeLane,
  calculateDriftMetrics,
  DEFAULT_DRIFT_THRESHOLDS,
} from '../../checkpoint/memory.js';
import type { Namespace, MemoryObject } from '../../checkpoint/types.js';

describe('Staleness Detection', () => {
  describe('calculateStalenessScore', () => {
    it('should return 0 for brand new memories', () => {
      const score = calculateStalenessScore(0);
      expect(score).toBe(0);
    });

    it('should return low score for memories within grace period', () => {
      // Grace period is 50% of max_age (1080 hours for default 2160 hours)
      const score = calculateStalenessScore(500); // ~21 days
      expect(score).toBeLessThan(0.2);
    });

    it('should return increasing score after grace period', () => {
      const score1 = calculateStalenessScore(1200); // 50 days
      const score2 = calculateStalenessScore(1800); // 75 days
      expect(score2).toBeGreaterThan(score1);
    });

    it('should return 1 for memories at or beyond max age', () => {
      const score = calculateStalenessScore(2160); // 90 days
      expect(score).toBe(1);
    });

    it('should respect custom SLO thresholds', () => {
      const customSLO = { ...DEFAULT_FRESHNESS_SLO, max_age_hours: 24 };
      const score = calculateStalenessScore(24, customSLO);
      expect(score).toBe(1);
    });
  });

  describe('computeStalenessMetrics', () => {
    it('should compute complete staleness metrics', () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const metrics = computeStalenessMetrics(
        oneDayAgo.toISOString(),
        undefined,
      );

      expect(metrics.age_hours).toBeCloseTo(24, 0);
      expect(metrics.age_days).toBeCloseTo(1, 0);
      expect(metrics.is_stale).toBe(false);
      expect(metrics.staleness_score).toBeLessThan(0.1);
      expect(metrics.stale_reason).toBeUndefined();
    });

    it('should mark old memories as stale', () => {
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000);

      const metrics = computeStalenessMetrics(
        ninetyDaysAgo.toISOString(),
        undefined,
      );

      expect(metrics.is_stale).toBe(true);
      expect(metrics.stale_reason).toContain('91 days old');
    });

    it('should use last_accessed_at if more recent', () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const metrics = computeStalenessMetrics(
        thirtyDaysAgo.toISOString(),
        oneDayAgo.toISOString(),
      );

      // Should use the more recent timestamp (1 day ago)
      expect(metrics.age_hours).toBeCloseTo(24, 0);
    });
  });
});

describe('Recall Failures', () => {
  describe('createRecallFailure', () => {
    it('should create failure with correct reason and message', () => {
      const failure = createRecallFailure('no_matches', {
        query: 'test query',
        namespaceKey: 'org:app:agent',
      });

      expect(failure.reason).toBe('no_matches');
      expect(failure.message).toBe('No memories matched the query');
      expect(failure.query).toBe('test query');
      expect(failure.suggestions).toContain('Try a broader query');
    });

    it('should create failure for stale results', () => {
      const failure = createRecallFailure('all_stale', {
        filteredCount: 5,
      });

      expect(failure.reason).toBe('all_stale');
      expect(failure.filtered_count).toBe(5);
      expect(failure.suggestions).toContain('Refresh memories with updated content');
    });

    it('should generate unique failure IDs', () => {
      const failure1 = createRecallFailure('no_matches');
      const failure2 = createRecallFailure('no_matches');

      expect(failure1.failure_id).not.toBe(failure2.failure_id);
    });
  });
});

describe('SLO Configuration', () => {
  describe('validateSLOConfig', () => {
    it('should accept valid config', () => {
      const result = validateSLOConfig(DEFAULT_SLO_CONFIG);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative max_age_hours', () => {
      const config = {
        ...DEFAULT_SLO_CONFIG,
        freshness: { ...DEFAULT_FRESHNESS_SLO, max_age_hours: -1 },
      };
      const result = validateSLOConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('freshness.max_age_hours must be positive');
    });

    it('should reject invalid relevance_threshold', () => {
      const config = {
        ...DEFAULT_SLO_CONFIG,
        freshness: { ...DEFAULT_FRESHNESS_SLO, relevance_threshold: 1.5 },
      };
      const result = validateSLOConfig(config);
      expect(result.valid).toBe(false);
    });
  });

  describe('mergeSLOConfig', () => {
    it('should fill missing values with defaults', () => {
      const partial = { enabled: false };
      const merged = mergeSLOConfig(partial);

      expect(merged.enabled).toBe(false);
      expect(merged.freshness.max_age_hours).toBe(DEFAULT_FRESHNESS_SLO.max_age_hours);
    });
  });

  describe('formatDuration', () => {
    it('should format hours', () => {
      expect(formatDuration(12)).toBe('12h');
    });

    it('should format days', () => {
      expect(formatDuration(48)).toBe('2d');
    });

    it('should format days and hours', () => {
      expect(formatDuration(50)).toBe('2d 2h');
    });
  });

  describe('parseDuration', () => {
    it('should parse hours', () => {
      expect(parseDuration('24h')).toBe(24);
    });

    it('should parse days', () => {
      expect(parseDuration('7d')).toBe(168);
    });

    it('should parse weeks', () => {
      expect(parseDuration('1w')).toBe(168);
    });

    it('should return null for invalid format', () => {
      expect(parseDuration('invalid')).toBeNull();
    });
  });
});

describe('Cross-Session Tracking', () => {
  let storage: InMemoryCheckpointStorage;
  let lane: KnowledgeLane;
  const namespace: Namespace = {
    org_id: 'test-org',
    app_id: 'test-app',
    agent_id: 'test-agent',
  };

  beforeEach(() => {
    storage = new InMemoryCheckpointStorage();
    lane = new KnowledgeLane(storage);
  });

  it('should track session_id in stored memories', async () => {
    const memory = await lane.storeMemory({
      namespace,
      content: 'Test memory',
      source: { type: 'user_input', identifier: 'user1' },
      session_id: 'session-123',
    });

    expect(memory.session_id).toBe('session-123');
    expect(memory.accessed_in_sessions).toEqual([]);
    expect(memory.cross_session_recall_count).toBe(0);
  });

  it('should return session history', async () => {
    // Create memories in different sessions
    await lane.storeMemory({
      namespace,
      content: 'Memory in session 1',
      source: { type: 'user_input', identifier: 'user1' },
      session_id: 'session-1',
    });

    await lane.storeMemory({
      namespace,
      content: 'Memory in session 2',
      source: { type: 'user_input', identifier: 'user1' },
      session_id: 'session-2',
    });

    const history = await lane.sessionHistory(namespace);

    expect(history).toHaveLength(2);
    expect(history.map(h => h.session_id)).toContain('session-1');
    expect(history.map(h => h.session_id)).toContain('session-2');
  });

  it('should return memories for a specific session', async () => {
    await lane.storeMemory({
      namespace,
      content: 'Memory A in session 1',
      source: { type: 'user_input', identifier: 'user1' },
      session_id: 'session-1',
    });

    await lane.storeMemory({
      namespace,
      content: 'Memory B in session 1',
      source: { type: 'user_input', identifier: 'user1' },
      session_id: 'session-1',
    });

    await lane.storeMemory({
      namespace,
      content: 'Memory C in session 2',
      source: { type: 'user_input', identifier: 'user1' },
      session_id: 'session-2',
    });

    const sessionMemories = await lane.getSessionMemories(namespace, 'session-1');

    expect(sessionMemories).toHaveLength(2);
    expect(sessionMemories.every(m => m.session_id === 'session-1')).toBe(true);
  });
});

describe('Drift Detection', () => {
  describe('calculateDriftMetrics', () => {
    it('should return zero drift for empty memories', () => {
      const metrics = calculateDriftMetrics([]);

      expect(metrics.drift_score).toBe(0);
      expect(metrics.drift_detected).toBe(false);
      expect(metrics.topic_changes).toBe(0);
      expect(metrics.coherence_score).toBe(1);
    });

    it('should detect low drift for coherent memories', () => {
      const memories: MemoryObject[] = [
        createTestMemory('1', ['project', 'api'], 0),
        createTestMemory('2', ['project', 'api', 'endpoint'], 1),
        createTestMemory('3', ['project', 'api', 'testing'], 2),
      ];

      const metrics = calculateDriftMetrics(memories);

      expect(metrics.drift_score).toBeLessThan(0.3);
      expect(metrics.drift_detected).toBe(false);
      expect(metrics.topic_changes).toBe(0);
    });

    it('should detect high drift for incoherent memories', () => {
      const memories: MemoryObject[] = [
        createTestMemory('1', ['project', 'frontend'], 0),
        createTestMemory('2', ['cooking', 'recipe'], 1),
        createTestMemory('3', ['vacation', 'travel'], 2),
        createTestMemory('4', ['finance', 'stocks'], 3),
      ];

      const metrics = calculateDriftMetrics(memories);

      expect(metrics.topic_changes).toBeGreaterThan(0);
      expect(metrics.fragmentation_score).toBeGreaterThan(0);
    });

    it('should calculate fragmentation correctly', () => {
      const memories: MemoryObject[] = [
        createTestMemory('1', ['unique-tag-1'], 0),
        createTestMemory('2', ['unique-tag-2'], 1),
        createTestMemory('3', ['unique-tag-3'], 2),
      ];

      const metrics = calculateDriftMetrics(memories);

      // All memories have unique tags, so fragmentation should be high
      expect(metrics.fragmentation_score).toBe(1);
    });
  });

  describe('KnowledgeLane.driftScore', () => {
    let storage: InMemoryCheckpointStorage;
    let lane: KnowledgeLane;
    const namespace: Namespace = {
      org_id: 'test-org',
      app_id: 'test-app',
      agent_id: 'test-agent',
    };

    beforeEach(() => {
      storage = new InMemoryCheckpointStorage();
      lane = new KnowledgeLane(storage);
    });

    it('should calculate drift for a session', async () => {
      await lane.storeMemory({
        namespace,
        content: 'Project setup',
        source: { type: 'user_input', identifier: 'user1' },
        tags: ['project', 'setup'],
        session_id: 'session-1',
      });

      await lane.storeMemory({
        namespace,
        content: 'API implementation',
        source: { type: 'user_input', identifier: 'user1' },
        tags: ['project', 'api'],
        session_id: 'session-1',
      });

      const metrics = await lane.driftScore(namespace, 'session-1');

      expect(metrics.drift_score).toBeDefined();
      expect(metrics.last_checked_at).toBeDefined();
    });

    it('should alert when drift exceeds threshold', async () => {
      // Create memories with completely different topics
      await lane.storeMemory({
        namespace,
        content: 'Topic A',
        source: { type: 'user_input', identifier: 'user1' },
        tags: ['alpha', 'beta'],
        session_id: 'drift-session',
      });

      await lane.storeMemory({
        namespace,
        content: 'Topic B',
        source: { type: 'user_input', identifier: 'user1' },
        tags: ['gamma', 'delta'],
        session_id: 'drift-session',
      });

      await lane.storeMemory({
        namespace,
        content: 'Topic C',
        source: { type: 'user_input', identifier: 'user1' },
        tags: ['epsilon', 'zeta'],
        session_id: 'drift-session',
      });

      const { alert, metrics } = await lane.checkDrift(
        namespace,
        'drift-session',
        { max_drift_score: 0.1, min_coherence_score: 0.9, max_fragmentation_score: 0.1 },
      );

      // With strict thresholds and divergent topics, should alert
      expect(alert).toBe(true);
    });
  });
});

describe('Memory Search with Failures', () => {
  let storage: InMemoryCheckpointStorage;
  const namespace: Namespace = {
    org_id: 'test-org',
    app_id: 'test-app',
    agent_id: 'test-agent',
  };

  beforeEach(() => {
    storage = new InMemoryCheckpointStorage();
  });

  it('should include staleness_score in results', async () => {
    const lane = new KnowledgeLane(storage);
    await lane.storeMemory({
      namespace,
      content: 'Test memory content',
      source: { type: 'user_input', identifier: 'user1' },
    });

    const results = await storage.searchMemories({
      namespace,
      include_content: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0].staleness_score).toBeDefined();
    expect(results[0].age_hours).toBeDefined();
    expect(results[0].time_until_stale_hours).toBeDefined();
  });

  it('should report failures in searchMemoriesWithResponse', async () => {
    const response = await storage.searchMemoriesWithResponse({
      namespace,
      query: 'nonexistent',
    });

    expect(response.failures).toHaveLength(1);
    expect(response.failures[0].reason).toBe('no_matches');
    expect(response.results).toHaveLength(0);
  });

  it('should track filtered counts', async () => {
    const lane = new KnowledgeLane(storage);

    // Create an old memory
    const oldMemory = await lane.storeMemory({
      namespace,
      content: 'Old memory',
      source: { type: 'user_input', identifier: 'user1' },
    });

    // Manually set it to be old
    const mem = await storage.getMemory(oldMemory.memory_id);
    if (mem) {
      const ninetyDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
      mem.created_at = ninetyDaysAgo.toISOString();
      await storage.saveMemory(mem);
    }

    const response = await storage.searchMemoriesWithResponse({
      namespace,
      max_age_seconds: 86400, // 1 day
    });

    expect(response.stale_filtered).toBeGreaterThan(0);
    expect(response.failures.some(f => f.reason === 'all_stale')).toBe(true);
  });
});

// Helper function to create test memories
function createTestMemory(
  id: string,
  tags: string[],
  dayOffset: number,
): MemoryObject {
  const created = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
  return {
    memory_id: id,
    namespace: { org_id: 'test', app_id: 'test', agent_id: 'test' },
    content: `Memory ${id}`,
    content_type: 'text',
    source: { type: 'user_input', identifier: 'test', timestamp: created.toISOString() },
    ingestion: {
      source_type: 'user_input',
      source_id: 'test',
      ingestion_timestamp: created.toISOString(),
      confidence_score: 1,
      detected_format: 'text',
      anomaly_flags: [],
      quarantined: false,
      validation_notes: [],
    },
    provenance: [],
    tags,
    importance: 0.5,
    task_criticality: 0.5,
    created_at: created.toISOString(),
    checkpoint_refs: [],
    version: 1,
    status: 'active',
  };
}
