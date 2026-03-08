/**
 * Trust Kernel Tests
 *
 * Issue #65: Staged Memory Promotion Engine (Trust Kernel)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { promises as fs } from 'fs';
import {
  TrustStore,
  WriteGate,
  TrustGate,
  ActionGate,
  SideEffectRegistry,
  PromotionWorker,
  createDefaultRules,
} from '../index.js';
import type { TrustEntry, PromotionRule } from '../types.js';

describe('TrustStore', () => {
  let store: TrustStore;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = join(tmpdir(), `trust-test-${Date.now()}.db`);
    store = new TrustStore({ dbPath: testDbPath });
  });

  afterEach(async () => {
    store.close();
    await fs.unlink(testDbPath).catch(() => {});
  });

  describe('Entry CRUD', () => {
    it('should create entry as candidate', () => {
      const entry = store.create({
        content: 'Test fact',
        scope: 'semantic',
        confidence: 0.8,
        source: 'test',
      });

      expect(entry.id).toBeDefined();
      expect(entry.state).toBe('candidate');
      expect(entry.scope).toBe('semantic');
      expect(entry.confidence).toBe(0.8);
    });

    it('should retrieve entry by ID', () => {
      const created = store.create({
        content: 'Test',
        scope: 'semantic',
        confidence: 0.5,
        source: 'test',
      });

      const retrieved = store.get(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.content).toBe('Test');
    });

    it('should query by state', () => {
      store.create({ content: 'A', scope: 'semantic', confidence: 0.5, source: 'test' });
      store.create({ content: 'B', scope: 'semantic', confidence: 0.5, source: 'test' });

      const candidates = store.query({ state: 'candidate' });
      expect(candidates.length).toBe(2);
    });

    it('should query by scope', () => {
      store.create({ content: 'Fact', scope: 'semantic', confidence: 0.5, source: 'test' });
      store.create({ content: 'Procedure', scope: 'procedural', confidence: 0.5, source: 'test' });

      const semantic = store.query({ scope: 'semantic' });
      expect(semantic.length).toBe(1);
      expect(semantic[0].scope).toBe('semantic');
    });
  });

  describe('State Transitions', () => {
    it('should transition candidate to stable', () => {
      const entry = store.create({
        content: 'Test',
        scope: 'semantic',
        confidence: 0.8,
        source: 'test',
      });

      const result = store.transition(entry.id, 'stable', 'Passed review', 'test-actor');

      expect(result.success).toBe(true);
      expect(result.event).toBeDefined();
      expect(result.event!.fromState).toBe('candidate');
      expect(result.event!.toState).toBe('stable');

      const updated = store.get(entry.id);
      expect(updated!.state).toBe('stable');
    });

    it('should reject invalid transition', () => {
      const entry = store.create({
        content: 'Test',
        scope: 'semantic',
        confidence: 0.8,
        source: 'test',
      });

      // First transition to stable
      store.transition(entry.id, 'stable', 'Promoted', 'test');

      // Try to transition back to candidate (invalid)
      const result = store.transition(entry.id, 'candidate', 'Rollback', 'test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });

    it('should record transition history', () => {
      const entry = store.create({
        content: 'Test',
        scope: 'semantic',
        confidence: 0.8,
        source: 'test',
      });

      store.transition(entry.id, 'stable', 'Promoted', 'actor1');

      const history = store.getTransitionHistory(entry.id);
      expect(history.length).toBe(1);
      expect(history[0].actor).toBe('actor1');
    });
  });

  describe('Denylist', () => {
    it('should add pattern to denylist', () => {
      store.addToDenylist('malicious', 'Security risk', 'admin');

      const check = store.isDenylisted('This is malicious content');
      expect(check.denied).toBe(true);
      expect(check.pattern).toBe('malicious');
    });

    it('should not deny safe content', () => {
      store.addToDenylist('malicious', 'Security risk', 'admin');

      const check = store.isDenylisted('This is safe content');
      expect(check.denied).toBe(false);
    });

    it('should track denylist epoch', () => {
      const epoch1 = store.getDenylistEpoch();
      store.addToDenylist('pattern1', 'reason', 'admin');
      const epoch2 = store.getDenylistEpoch();

      expect(epoch2).toBeGreaterThan(epoch1);
    });
  });

  describe('Metrics', () => {
    it('should return accurate metrics', () => {
      store.create({ content: 'A', scope: 'semantic', confidence: 0.5, source: 'test' });
      store.create({ content: 'B', scope: 'procedural', confidence: 0.5, source: 'test' });

      const metrics = store.getMetrics();
      expect(metrics.entriesByState.candidate).toBe(2);
      expect(metrics.entriesByScope.semantic).toBe(1);
      expect(metrics.entriesByScope.procedural).toBe(1);
    });
  });
});

describe('WriteGate', () => {
  let store: TrustStore;
  let gate: WriteGate;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = join(tmpdir(), `writegate-test-${Date.now()}.db`);
    store = new TrustStore({ dbPath: testDbPath });
    gate = new WriteGate({ store });
  });

  afterEach(async () => {
    store.close();
    await fs.unlink(testDbPath).catch(() => {});
  });

  it('should allow valid writes', () => {
    const result = gate.evaluate({
      content: 'Test fact',
      source: 'test',
      confidence: 0.8,
    });

    expect(result.allowed).toBe(true);
    expect(result.assignedState).toBe('candidate');
  });

  it('should block denylisted content', () => {
    store.addToDenylist('forbidden', 'Not allowed', 'admin');

    const result = gate.evaluate({
      content: 'This is forbidden content',
      source: 'test',
    });

    expect(result.allowed).toBe(false);
    expect(result.assignedState).toBe('rejected');
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it('should process and persist allowed writes', async () => {
    const { entry, result } = await gate.process({
      content: 'New fact',
      source: 'test',
      confidence: 0.7,
      tags: ['important'],
    });

    expect(result.allowed).toBe(true);
    expect(entry).toBeDefined();
    expect(entry!.tags).toContain('important');

    const retrieved = store.get(entry!.id);
    expect(retrieved).not.toBeNull();
  });
});

describe('TrustGate', () => {
  let store: TrustStore;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = join(tmpdir(), `trustgate-test-${Date.now()}.db`);
    store = new TrustStore({ dbPath: testDbPath });
  });

  afterEach(async () => {
    store.close();
    await fs.unlink(testDbPath).catch(() => {});
  });

  it('should pass stable entries in enforce mode', () => {
    const entry = store.create({
      content: 'Fact',
      scope: 'semantic',
      confidence: 0.9,
      source: 'test',
    });
    store.transition(entry.id, 'stable', 'Promoted', 'test');

    const gate = new TrustGate({ store, mode: 'enforce_query' });
    const stableEntry = store.get(entry.id)!;
    const result = gate.evaluate([stableEntry]);

    expect(result.trustedEntries.length).toBe(1);
    expect(result.filteredEntries.length).toBe(0);
  });

  it('should filter candidate entries in enforce mode', () => {
    const entry = store.create({
      content: 'Candidate',
      scope: 'semantic',
      confidence: 0.5,
      source: 'test',
    });

    const gate = new TrustGate({ store, mode: 'enforce_query' });
    const result = gate.evaluate([entry]);

    expect(result.trustedEntries.length).toBe(0);
    expect(result.filteredEntries.length).toBe(1);
  });

  it('should pass all entries in shadow mode', () => {
    const entry = store.create({
      content: 'Candidate',
      scope: 'semantic',
      confidence: 0.5,
      source: 'test',
    });

    const gate = new TrustGate({ store, mode: 'shadow' });
    const result = gate.evaluate([entry]);

    expect(result.trustedEntries.length).toBe(1);
    expect(result.filteredEntries.length).toBe(0);
  });
});

describe('ActionGate', () => {
  let store: TrustStore;
  let registry: SideEffectRegistry;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = join(tmpdir(), `actiongate-test-${Date.now()}.db`);
    store = new TrustStore({ dbPath: testDbPath });
    registry = new SideEffectRegistry();
  });

  afterEach(async () => {
    store.close();
    await fs.unlink(testDbPath).catch(() => {});
  });

  it('should block unregistered tools (deny-by-default)', () => {
    const gate = new ActionGate({ store, registry, mode: 'enforce_action' });

    const result = gate.evaluate({ toolName: 'unknown_tool' });

    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("Tool 'unknown_tool' not registered (deny-by-default)");
  });

  it('should allow registered tools', () => {
    registry.register({
      effectType: 'read_pure',
      toolName: 'safe_read',
      requiredTrustLevel: 'any',
      requiresExplicitAuth: false,
      auditLevel: 'none',
    });

    const gate = new ActionGate({ store, registry, mode: 'enforce_action' });
    const result = gate.evaluate({ toolName: 'safe_read' });

    expect(result.allowed).toBe(true);
    expect(result.registration).toBeDefined();
  });

  it('should allow unregistered tools in shadow mode', () => {
    const gate = new ActionGate({ store, registry, mode: 'shadow' });

    const result = gate.evaluate({ toolName: 'unknown_tool' });

    expect(result.allowed).toBe(true);
  });
});

describe('PromotionWorker', () => {
  let store: TrustStore;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = join(tmpdir(), `worker-test-${Date.now()}.db`);
    store = new TrustStore({ dbPath: testDbPath });
  });

  afterEach(async () => {
    store.close();
    await fs.unlink(testDbPath).catch(() => {});
  });

  it('should promote high confidence entries', () => {
    const entry = store.create({
      content: 'High confidence fact',
      scope: 'semantic',
      confidence: 0.9,
      source: 'test',
    });

    // Wait for minimum age (or use a rule with 0 minAge)
    const rules: PromotionRule[] = [
      {
        id: 'test-rule',
        name: 'Test Rule',
        scope: 'semantic',
        minConfidence: 0.8,
        minAgeSeconds: 0,
        enabled: true,
      },
    ];

    const worker = new PromotionWorker({ store, rules });
    const result = worker.evaluateEntry(entry);

    expect(result.promoted).toBe(true);
    expect(result.matchedRule).toBeDefined();
    expect(result.matchedRule!.id).toBe('test-rule');

    const updated = store.get(entry.id);
    expect(updated!.state).toBe('stable');
  });

  it('should not promote low confidence entries', () => {
    const entry = store.create({
      content: 'Low confidence fact',
      scope: 'semantic',
      confidence: 0.3,
      source: 'test',
    });

    const rules: PromotionRule[] = [
      {
        id: 'test-rule',
        name: 'Test Rule',
        scope: 'semantic',
        minConfidence: 0.8,
        minAgeSeconds: 0,
        enabled: true,
      },
    ];

    const worker = new PromotionWorker({ store, rules });
    const result = worker.evaluateEntry(entry);

    expect(result.promoted).toBe(false);
    expect(result.rejectionReasons).toBeDefined();
    expect(result.rejectionReasons!.length).toBeGreaterThan(0);
  });

  it('should never promote episodic entries', () => {
    const entry = store.create({
      content: 'Episodic event',
      scope: 'episodic',
      confidence: 1.0,
      source: 'test',
      ttlSeconds: 3600,
    });

    const rules: PromotionRule[] = [
      {
        id: 'any-rule',
        name: 'Any Rule',
        scope: 'episodic', // Even if we have a rule for episodic
        minConfidence: 0,
        minAgeSeconds: 0,
        enabled: true,
      },
    ];

    const worker = new PromotionWorker({ store, rules });
    const result = worker.evaluateEntry(entry);

    expect(result.promoted).toBe(false);
  });

  it('should run batch promotion', () => {
    // Create several entries
    store.create({ content: 'A', scope: 'semantic', confidence: 0.9, source: 'test' });
    store.create({ content: 'B', scope: 'semantic', confidence: 0.4, source: 'test' });
    store.create({ content: 'C', scope: 'semantic', confidence: 0.95, source: 'test' });

    const rules: PromotionRule[] = [
      {
        id: 'test-rule',
        name: 'Test',
        scope: 'semantic',
        minConfidence: 0.8,
        minAgeSeconds: 0,
        enabled: true,
      },
    ];

    const worker = new PromotionWorker({ store, rules });
    const batch = worker.runBatch(0);

    expect(batch.total).toBe(3);
    expect(batch.promoted).toBe(2); // A and C
    expect(batch.rejected).toBe(1); // B
  });
});

describe('createDefaultRules', () => {
  it('should return valid rules', () => {
    const rules = createDefaultRules();

    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.id).toBeDefined();
      expect(rule.name).toBeDefined();
      expect(rule.scope).toBeDefined();
      expect(rule.enabled).toBe(true);
    }
  });
});
