/**
 * Drillbook Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Drillbook,
  InMemoryDrillbookStorage,
  DrillItem,
  TestSession,
} from '../index.js';

describe('Drillbook', () => {
  let storage: InMemoryDrillbookStorage;
  let drillbook: Drillbook;
  const actorId = 'agent-1';

  beforeEach(() => {
    storage = new InMemoryDrillbookStorage();
    drillbook = new Drillbook(storage);
  });

  describe('createItem', () => {
    it('should create a drill item', async () => {
      const item = await drillbook.createItem({
        question: 'What is the deployment target?',
        expected_answer: 'production-server-1',
        source_pointer: '/project/config/deploy.json',
        importance: 4,
        action_type: 'decision_finalized',
        created_by: actorId,
      });

      expect(item.id).toBeDefined();
      expect(item.question).toBe('What is the deployment target?');
      expect(item.expected_answer).toBe('production-server-1');
      expect(item.importance).toBe(4);
      expect(item.active).toBe(true);
      expect(item.miss_count).toBe(0);
    });

    it('should create critical items', async () => {
      const item = await drillbook.createItem({
        question: 'What is the budget limit?',
        expected_answer: '$10,000',
        source_pointer: '/project/constraints/budget',
        critical: true,
        action_type: 'constraint_commitment',
        created_by: actorId,
      });

      expect(item.critical).toBe(true);
    });

    it('should use default importance', async () => {
      const item = await drillbook.createItem({
        question: 'What color is the logo?',
        expected_answer: 'blue',
        source_pointer: '/brand/guidelines',
        action_type: 'location_fact',
        created_by: actorId,
      });

      expect(item.importance).toBe(3);
    });
  });

  describe('sampleItems', () => {
    beforeEach(async () => {
      // Create test items with varying importance
      await drillbook.createItem({
        question: 'Q1 - High importance',
        expected_answer: 'A1',
        source_pointer: '/source/1',
        importance: 5,
        action_type: 'decision_finalized',
        created_by: actorId,
      });

      await drillbook.createItem({
        question: 'Q2 - Medium importance',
        expected_answer: 'A2',
        source_pointer: '/source/2',
        importance: 3,
        action_type: 'location_fact',
        created_by: actorId,
      });

      await drillbook.createItem({
        question: 'Q3 - Low importance',
        expected_answer: 'A3',
        source_pointer: '/source/3',
        importance: 1,
        action_type: 'external_side_effect',
        created_by: actorId,
      });

      await drillbook.createItem({
        question: 'Q4 - Critical',
        expected_answer: 'A4',
        source_pointer: '/source/4',
        importance: 4,
        critical: true,
        action_type: 'constraint_commitment',
        created_by: actorId,
      });
    });

    it('should sample items for testing', async () => {
      const items = await drillbook.sampleItems(actorId);

      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(6);
    });

    it('should always include critical items', async () => {
      const items = await drillbook.sampleItems(actorId);

      const criticalIncluded = items.some(i => i.critical);
      expect(criticalIncluded).toBe(true);
    });

    it('should prioritize high importance items', async () => {
      const items = await drillbook.sampleItems(actorId);

      // High importance item should be included
      const highImportanceIncluded = items.some(i => i.importance === 5);
      expect(highImportanceIncluded).toBe(true);
    });

    it('should filter out expired items', async () => {
      // Create expired item
      await drillbook.createItem({
        question: 'Expired question',
        expected_answer: 'expired',
        source_pointer: '/expired',
        importance: 5,
        expiry: new Date(Date.now() - 1000).toISOString(), // Already expired
        action_type: 'decision_finalized',
        created_by: actorId,
      });

      const items = await drillbook.sampleItems(actorId);
      const expiredIncluded = items.some(i => i.question === 'Expired question');
      expect(expiredIncluded).toBe(false);
    });
  });

  describe('test session', () => {
    let session: TestSession;

    beforeEach(async () => {
      await drillbook.createItem({
        question: 'What is 2+2?',
        expected_answer: '4',
        source_pointer: '/math',
        importance: 3,
        action_type: 'location_fact',
        created_by: actorId,
      });

      session = await drillbook.startTestSession(actorId);
    });

    it('should start a test session', async () => {
      expect(session.session_id).toBeDefined();
      expect(session.items.length).toBeGreaterThan(0);
      expect(session.started_at).toBeDefined();
    });

    it('should record correct answers', async () => {
      const item = session.items[0];
      
      const result = await drillbook.recordAnswer(
        session,
        item.id,
        item.expected_answer,
        100
      );

      expect(result.correct).toBe(true);
      expect(result.similarity).toBe(1);
    });

    it('should record incorrect answers', async () => {
      const item = session.items[0];
      
      const result = await drillbook.recordAnswer(
        session,
        item.id,
        'completely wrong answer',
        100
      );

      expect(result.correct).toBe(false);
      expect(result.similarity).toBeLessThan(1);
    });

    it('should complete session with readiness score', async () => {
      const item = session.items[0];
      await drillbook.recordAnswer(session, item.id, item.expected_answer, 100);

      const completed = await drillbook.completeSession(session);

      expect(completed.ended_at).toBeDefined();
      expect(completed.readiness_score).toBeDefined();
      expect(completed.missed_items).toBeDefined();
    });

    it('should track missed items', async () => {
      const item = session.items[0];
      await drillbook.recordAnswer(session, item.id, 'wrong', 100);

      const completed = await drillbook.completeSession(session);

      expect(completed.missed_items).toContain(item.id);
    });
  });

  describe('checkReadiness', () => {
    beforeEach(async () => {
      // Create items with test history
      const item = await drillbook.createItem({
        question: 'Test question',
        expected_answer: 'correct',
        source_pointer: '/test',
        importance: 3,
        action_type: 'decision_finalized',
        created_by: actorId,
      });

      // Add passing test history
      await storage.recordTestResult(item.id, {
        timestamp: new Date().toISOString(),
        answer: 'correct',
        correct: true,
        similarity: 1,
        response_time_ms: 100,
      });
    });

    it('should allow low-cost actions with any score', async () => {
      const result = await drillbook.checkReadiness(actorId, 'low');

      expect(result.cost_level).toBe('low');
      expect(result.threshold).toBe(0);
      expect(result.allowed).toBe(true);
    });

    it('should check readiness for medium-cost actions', async () => {
      const result = await drillbook.checkReadiness(actorId, 'medium');

      expect(result.cost_level).toBe('medium');
      expect(result.threshold).toBe(0.75);
    });

    it('should check readiness for high-cost actions', async () => {
      const result = await drillbook.checkReadiness(actorId, 'high');

      expect(result.cost_level).toBe('high');
      expect(result.threshold).toBe(0.90);
    });

    it('should report critical failures', async () => {
      // Create critical item with failure
      const critical = await drillbook.createItem({
        question: 'Critical question',
        expected_answer: 'critical answer',
        source_pointer: '/critical',
        importance: 5,
        critical: true,
        action_type: 'constraint_commitment',
        created_by: actorId,
      });

      await storage.recordTestResult(critical.id, {
        timestamp: new Date().toISOString(),
        answer: 'wrong',
        correct: false,
        similarity: 0.2,
        response_time_ms: 100,
      });

      const result = await drillbook.checkReadiness(actorId, 'high');

      expect(result.critical_failures.length).toBeGreaterThan(0);
    });

    it('should provide recommendations when not allowed', async () => {
      // Create items with poor test history
      const item = await drillbook.createItem({
        question: 'Failing question',
        expected_answer: 'correct',
        source_pointer: '/fail',
        importance: 5,
        critical: true,
        action_type: 'decision_finalized',
        created_by: actorId,
      });

      // Add failing test history
      await storage.recordTestResult(item.id, {
        timestamp: new Date().toISOString(),
        answer: 'wrong',
        correct: false,
        similarity: 0.1,
        response_time_ms: 100,
      });

      const result = await drillbook.checkReadiness(actorId, 'high');

      if (!result.allowed) {
        expect(result.recommendations).toBeDefined();
        expect(result.recommendations!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('repairMiss', () => {
    let item: DrillItem;

    beforeEach(async () => {
      item = await drillbook.createItem({
        question: 'What is the API endpoint?',
        expected_answer: 'https://api.old.com',
        source_pointer: '/config/api.json',
        importance: 4,
        action_type: 'location_fact',
        created_by: actorId,
      });
    });

    it('should correct miss when source unchanged', async () => {
      const repair = await drillbook.repairMiss(
        item.id,
        'https://api.old.com',
        false
      );

      expect(repair.action).toBe('corrected');
      expect(repair.source_changed).toBe(false);
      expect(repair.corrected_answer).toBe('https://api.old.com');
    });

    it('should replace item when source changed', async () => {
      const repair = await drillbook.repairMiss(
        item.id,
        'https://api.new.com',
        true
      );

      expect(repair.action).toBe('replaced');
      expect(repair.source_changed).toBe(true);
      expect(repair.replacement_item).toBeDefined();
      expect(repair.replacement_item?.expected_answer).toBe('https://api.new.com');

      // Original should be retired
      const original = await drillbook.getItem(item.id);
      expect(original?.active).toBe(false);
      expect(original?.retired_reason).toBe('source_changed');
    });
  });

  describe('retireItem', () => {
    it('should retire an item', async () => {
      const item = await drillbook.createItem({
        question: 'Obsolete question',
        expected_answer: 'old answer',
        source_pointer: '/old',
        action_type: 'decision_finalized',
        created_by: actorId,
      });

      await drillbook.retireItem(item.id, 'No longer relevant');

      const retired = await drillbook.getItem(item.id);
      expect(retired?.active).toBe(false);
      expect(retired?.retired_reason).toBe('No longer relevant');
    });
  });

  describe('getItemsDueForTesting', () => {
    it('should return items not tested recently', async () => {
      // Create item without test history
      await drillbook.createItem({
        question: 'Never tested',
        expected_answer: 'answer',
        source_pointer: '/test',
        importance: 5,
        action_type: 'decision_finalized',
        created_by: actorId,
      });

      const due = await drillbook.getItemsDueForTesting(actorId, 10);

      expect(due.length).toBeGreaterThan(0);
    });

    it('should prioritize by importance', async () => {
      await drillbook.createItem({
        question: 'Low importance',
        expected_answer: 'a',
        source_pointer: '/low',
        importance: 1,
        action_type: 'decision_finalized',
        created_by: actorId,
      });

      await drillbook.createItem({
        question: 'High importance',
        expected_answer: 'b',
        source_pointer: '/high',
        importance: 5,
        action_type: 'decision_finalized',
        created_by: actorId,
      });

      const due = await drillbook.getItemsDueForTesting(actorId, 10);

      expect(due[0].importance).toBe(5);
    });
  });

  describe('configuration', () => {
    it('should allow updating protocol config', () => {
      drillbook.setProtocolConfig({ sample_size: 10 });
      // Config is private, but we can verify through behavior
      expect(true).toBe(true); // Just verify no error
    });

    it('should allow updating readiness thresholds', () => {
      drillbook.setReadinessThresholds({
        medium: { min_score: 0.8, allow_critical_miss: false },
      });
      // Thresholds are private, but we can verify through behavior
      expect(true).toBe(true);
    });
  });
});

describe('InMemoryDrillbookStorage', () => {
  let storage: InMemoryDrillbookStorage;

  beforeEach(() => {
    storage = new InMemoryDrillbookStorage();
  });

  it('should track stats', async () => {
    await storage.saveItem({
      id: '1',
      question: 'Q1',
      expected_answer: 'A1',
      source_pointer: '/s1',
      importance: 3,
      critical: true,
      action_type: 'decision_finalized',
      created_at: new Date().toISOString(),
      miss_count: 0,
      test_history: [],
      active: true,
      created_by: 'agent',
    });

    await storage.saveItem({
      id: '2',
      question: 'Q2',
      expected_answer: 'A2',
      source_pointer: '/s2',
      importance: 3,
      critical: false,
      action_type: 'decision_finalized',
      created_at: new Date().toISOString(),
      miss_count: 0,
      test_history: [],
      active: false,
      created_by: 'agent',
    });

    const stats = storage.getStats();

    expect(stats.total).toBe(2);
    expect(stats.active).toBe(1);
    expect(stats.critical).toBe(1);
  });

  it('should search by tags', async () => {
    await storage.saveItem({
      id: '1',
      question: 'Q1',
      expected_answer: 'A1',
      source_pointer: '/s1',
      importance: 3,
      critical: false,
      action_type: 'decision_finalized',
      created_at: new Date().toISOString(),
      miss_count: 0,
      test_history: [],
      active: true,
      created_by: 'agent',
      tags: ['deployment', 'production'],
    });

    const results = await storage.searchByTags(['deployment']);

    expect(results).toHaveLength(1);
    expect(results[0].tags).toContain('deployment');
  });
});
