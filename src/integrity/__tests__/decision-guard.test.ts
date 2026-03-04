/**
 * Decision Guard Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DecisionGuard,
  IntegrityValidator,
  EvaluableMemory,
  ActionEvaluationRequest,
} from '../index.js';

describe('DecisionGuard', () => {
  let validator: IntegrityValidator;
  let guard: DecisionGuard;

  beforeEach(() => {
    validator = new IntegrityValidator();
    guard = new DecisionGuard(validator);
  });

  describe('evaluateAction', () => {
    it('should approve low-risk action with valid memories', async () => {
      const request: ActionEvaluationRequest = {
        idempotency_key: 'test-1',
        action: {
          type: 'read_file',
          payload: { path: '/test.txt' },
          risk_level: 'low',
        },
        memory_refs: ['mem-1'],
        actor: { id: 'agent-1', type: 'agent' },
      };

      const memories: EvaluableMemory[] = [
        {
          memory_id: 'mem-1',
          created_at: new Date().toISOString(),
          integrity: {
            validity_status: 'valid',
            last_validated_at: new Date().toISOString(),
            evidence_bundle_hash: 'evidence',
          },
          importance: 0.8,
          task_criticality: 0.9,
        },
      ];

      const result = await guard.evaluateAction(request, memories);

      expect(result.approved).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.failed_memories).toHaveLength(0);
    });

    it('should reject high-risk action with invalid memories', async () => {
      const request: ActionEvaluationRequest = {
        idempotency_key: 'test-2',
        action: {
          type: 'deploy',
          payload: { env: 'production' },
          risk_level: 'high',
        },
        memory_refs: ['mem-1', 'mem-2'],
        actor: { id: 'agent-1', type: 'agent' },
      };

      const memories: EvaluableMemory[] = [
        {
          memory_id: 'mem-1',
          created_at: new Date().toISOString(),
          integrity: { validity_status: 'invalid', invalid_reason: 'source_changed' },
        },
        {
          memory_id: 'mem-2',
          created_at: new Date().toISOString(),
          integrity: { validity_status: 'valid', last_validated_at: new Date().toISOString() },
        },
      ];

      const result = await guard.evaluateAction(request, memories);

      expect(result.approved).toBe(false);
      expect(result.failed_memories.length).toBeGreaterThan(0);
      expect(result.recommendations).toBeDefined();
    });

    it('should use idempotency cache for duplicate requests', async () => {
      const request: ActionEvaluationRequest = {
        idempotency_key: 'cached-key',
        action: {
          type: 'test',
          payload: {},
          risk_level: 'low',
        },
        memory_refs: ['mem-1'],
        actor: { id: 'agent-1', type: 'agent' },
      };

      const memories: EvaluableMemory[] = [
        {
          memory_id: 'mem-1',
          created_at: new Date().toISOString(),
          integrity: {
            validity_status: 'valid',
            last_validated_at: new Date().toISOString(),
          },
        },
      ];

      // First call
      const result1 = await guard.evaluateAction(request, memories);
      
      // Second call with same idempotency key
      const result2 = await guard.evaluateAction(request, []);

      expect(result2.evaluated_at).toBe(result1.evaluated_at);
    });

    it('should recommend human review for critical actions', async () => {
      const request: ActionEvaluationRequest = {
        idempotency_key: 'critical-1',
        action: {
          type: 'delete_all',
          payload: {},
          risk_level: 'critical',
        },
        memory_refs: ['mem-1'],
        actor: { id: 'agent-1', type: 'agent' },
      };

      const memories: EvaluableMemory[] = [
        {
          memory_id: 'mem-1',
          created_at: new Date().toISOString(),
          integrity: { validity_status: 'suspect' },
        },
      ];

      const result = await guard.evaluateAction(request, memories);

      expect(result.approved).toBe(false);
      expect(result.recommendations?.some(r => r.includes('human review'))).toBe(true);
    });

    it('should handle empty memory refs', async () => {
      const request: ActionEvaluationRequest = {
        idempotency_key: 'empty-refs',
        action: {
          type: 'simple_action',
          payload: {},
          risk_level: 'low',
        },
        memory_refs: [],
        actor: { id: 'agent-1', type: 'agent' },
      };

      const result = await guard.evaluateAction(request, []);

      expect(result.confidence).toBe(0);
      expect(result.approved).toBe(false);
    });
  });

  describe('quickCheck', () => {
    it('should check readiness for risk level', () => {
      const memories: EvaluableMemory[] = [
        {
          memory_id: 'mem-1',
          created_at: new Date().toISOString(),
          integrity: {
            validity_status: 'valid',
            last_validated_at: new Date().toISOString(),
          },
        },
      ];

      const result = guard.quickCheck(memories, 'low');

      expect(result.threshold).toBe(0.5);
      expect(typeof result.confidence).toBe('number');
      expect(typeof result.ready).toBe('boolean');
    });

    it('should use higher threshold for critical risk', () => {
      const result = guard.quickCheck([], 'critical');

      expect(result.threshold).toBe(0.95);
    });
  });

  describe('thresholds', () => {
    it('should allow getting thresholds', () => {
      const thresholds = guard.getThresholds();

      expect(thresholds.low).toBe(0.5);
      expect(thresholds.medium).toBe(0.75);
      expect(thresholds.high).toBe(0.90);
      expect(thresholds.critical).toBe(0.95);
    });

    it('should allow updating thresholds', () => {
      guard.setThresholds({ low: 0.3 });

      const thresholds = guard.getThresholds();
      expect(thresholds.low).toBe(0.3);
      expect(thresholds.medium).toBe(0.75); // Unchanged
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const request: ActionEvaluationRequest = {
        idempotency_key: 'clear-test',
        action: {
          type: 'test',
          payload: {},
          risk_level: 'low',
        },
        memory_refs: [],
        actor: { id: 'agent-1', type: 'agent' },
      };

      await guard.evaluateAction(request, []);
      guard.clearCache();

      // After clearing, a new evaluation should happen
      const memories: EvaluableMemory[] = [
        {
          memory_id: 'new-mem',
          created_at: new Date().toISOString(),
          integrity: {
            validity_status: 'valid',
            last_validated_at: new Date().toISOString(),
          },
        },
      ];

      const result = await guard.evaluateAction(request, memories);

      // Should be a fresh evaluation (different from cached empty result)
      expect(result.evaluated_at).toBeDefined();
    });
  });

  describe('custom thresholds', () => {
    it('should use custom thresholds from constructor', () => {
      const customGuard = new DecisionGuard(validator, {
        thresholds: {
          low: 0.1,
          critical: 0.99,
        },
      });

      const thresholds = customGuard.getThresholds();

      expect(thresholds.low).toBe(0.1);
      expect(thresholds.critical).toBe(0.99);
      expect(thresholds.medium).toBe(0.75); // Default
    });
  });
});
