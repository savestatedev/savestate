/**
 * Tests for Retrieval Explainability ("Why this memory?" inspector)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  explainMemory,
  calculateScoreBreakdown,
  calculateCompositeScore,
  buildSourceTrace,
  buildPolicyPath,
  formatExplanationHuman,
  formatExplanationMarkdown,
} from '../explain.js';
import { DEFAULT_SCORING_WEIGHTS } from '../types.js';
import type { MemoryEntry, Snapshot } from '../../types.js';
import { DEFAULT_TIER_CONFIG } from '../../commands/memory.js';

// ─── Test Fixtures ───────────────────────────────────────────

function createMockMemoryEntry(overrides?: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: 'mem-test-123',
    content: 'This is a test memory about JavaScript and TypeScript development.',
    source: 'manual',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    tier: 'L2',
    pinned: false,
    ...overrides,
  };
}

function createMockSnapshot(memoryEntry: MemoryEntry): Snapshot {
  return {
    manifest: {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      id: 'snap-abc123',
      platform: 'openclaw',
      adapter: 'openclaw-adapter',
      checksum: 'sha256:abc123',
      size: 1024,
    },
    identity: {},
    memory: {
      core: [memoryEntry],
      knowledge: [],
      tierConfig: DEFAULT_TIER_CONFIG,
    },
    conversations: {
      total: 0,
      conversations: [],
    },
    platform: {
      name: 'openclaw',
      exportMethod: 'api',
    },
    chain: {
      current: 'snap-abc123',
      ancestors: [],
    },
    restoreHints: {
      platform: 'openclaw',
      steps: [],
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────

describe('explainMemory', () => {
  let entry: MemoryEntry;
  let snapshot: Snapshot;

  beforeEach(() => {
    entry = createMockMemoryEntry();
    snapshot = createMockSnapshot(entry);
  });

  it('should return a complete explanation', () => {
    const explanation = explainMemory(entry, snapshot);

    expect(explanation.memoryId).toBe(entry.id);
    expect(explanation.compositeScore).toBeGreaterThan(0);
    expect(explanation.compositeScore).toBeLessThanOrEqual(1);
    expect(explanation.scoreBreakdown).toBeDefined();
    expect(explanation.sourceTrace).toBeDefined();
    expect(explanation.policyPath).toBeDefined();
    expect(explanation.summary).toBeTruthy();
  });

  it('should include all scoring factors', () => {
    const explanation = explainMemory(entry, snapshot);
    const factorNames = explanation.scoreBreakdown.factors.map((f) => f.name);

    expect(factorNames).toContain('relevance');
    expect(factorNames).toContain('recency');
    expect(factorNames).toContain('tier');
    expect(factorNames).toContain('access');
    expect(factorNames).toContain('pinned');
  });

  it('should calculate relevance when query is provided', () => {
    // Use a query that appears as-is in the content
    const explanation = explainMemory(entry, snapshot, {
      query: 'test memory',
    });

    const relevanceFactor = explanation.scoreBreakdown.factors.find(
      (f) => f.name === 'relevance',
    );

    expect(relevanceFactor).toBeDefined();
    expect(relevanceFactor!.value).toBeGreaterThan(0);
    expect(relevanceFactor!.explanation).toContain('test memory');
  });

  it('should assume full relevance when no query provided', () => {
    const explanation = explainMemory(entry, snapshot);

    const relevanceFactor = explanation.scoreBreakdown.factors.find(
      (f) => f.name === 'relevance',
    );

    expect(relevanceFactor!.value).toBe(1);
    expect(relevanceFactor!.explanation).toContain('No query provided');
  });
});

describe('calculateScoreBreakdown', () => {
  it('should calculate recency weight based on age', () => {
    // Note: recency is based on lastAccessedAt ?? updatedAt ?? createdAt
    // So we need to set all timestamps to test recency properly
    const now = new Date();
    const recentEntry = createMockMemoryEntry({
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastAccessedAt: now.toISOString(),
    });
    const oldEntry = createMockMemoryEntry({
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      lastAccessedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const recentBreakdown = calculateScoreBreakdown(recentEntry);
    const oldBreakdown = calculateScoreBreakdown(oldEntry);

    expect(recentBreakdown.recencyWeight).toBeGreaterThan(oldBreakdown.recencyWeight);
    expect(recentBreakdown.recencyWeight).toBeCloseTo(1, 1);
  });

  it('should give tier boost based on memory tier', () => {
    const l1Entry = createMockMemoryEntry({ tier: 'L1' });
    const l2Entry = createMockMemoryEntry({ tier: 'L2' });
    const l3Entry = createMockMemoryEntry({ tier: 'L3' });

    const l1Breakdown = calculateScoreBreakdown(l1Entry);
    const l2Breakdown = calculateScoreBreakdown(l2Entry);
    const l3Breakdown = calculateScoreBreakdown(l3Entry);

    expect(l1Breakdown.tierBoost).toBeGreaterThan(l2Breakdown.tierBoost);
    expect(l2Breakdown.tierBoost).toBeGreaterThan(l3Breakdown.tierBoost);
  });

  it('should give pinned boost for pinned memories', () => {
    const pinnedEntry = createMockMemoryEntry({
      pinned: true,
      pinnedAt: new Date().toISOString(),
    });
    const unpinnedEntry = createMockMemoryEntry({ pinned: false });

    const pinnedBreakdown = calculateScoreBreakdown(pinnedEntry);
    const unpinnedBreakdown = calculateScoreBreakdown(unpinnedEntry);

    expect(pinnedBreakdown.pinnedBoost).toBe(1);
    expect(unpinnedBreakdown.pinnedBoost).toBe(0);
  });
});

describe('calculateCompositeScore', () => {
  it('should normalize scores to 0-1 range', () => {
    const entry = createMockMemoryEntry();
    const breakdown = calculateScoreBreakdown(entry);
    const composite = calculateCompositeScore(breakdown);

    expect(composite).toBeGreaterThanOrEqual(0);
    expect(composite).toBeLessThanOrEqual(1);
  });

  it('should weight factors according to weights', () => {
    const entry = createMockMemoryEntry({
      tier: 'L1',
      pinned: true,
      pinnedAt: new Date().toISOString(),
    });
    const breakdown = calculateScoreBreakdown(entry, 'test query');

    // With high tier and pinned, should have higher score
    const composite = calculateCompositeScore(breakdown);
    expect(composite).toBeGreaterThan(0.5);
  });
});

describe('buildSourceTrace', () => {
  it('should include snapshot chain information', () => {
    const entry = createMockMemoryEntry();
    const snapshot = createMockSnapshot(entry);
    snapshot.chain.ancestors = ['snap-old1', 'snap-old2'];

    const trace = buildSourceTrace(entry, snapshot);

    expect(trace.currentSnapshotId).toBe('snap-abc123');
    expect(trace.snapshotChain).toContain('snap-old1');
    expect(trace.snapshotChain).toContain('snap-old2');
    expect(trace.snapshotChain).toContain('snap-abc123');
  });

  it('should identify source type from entry metadata', () => {
    const conversationEntry = createMockMemoryEntry({
      source: 'conversation',
      metadata: { conversationId: 'conv-123' },
    });
    const importEntry = createMockMemoryEntry({ source: 'import' });
    const manualEntry = createMockMemoryEntry({ source: 'manual' });

    const convTrace = buildSourceTrace(conversationEntry, createMockSnapshot(conversationEntry));
    const importTrace = buildSourceTrace(importEntry, createMockSnapshot(importEntry));
    const manualTrace = buildSourceTrace(manualEntry, createMockSnapshot(manualEntry));

    expect(convTrace.sourceType).toBe('conversation');
    expect(importTrace.sourceType).toBe('import');
    expect(manualTrace.sourceType).toBe('manual');
  });
});

describe('buildPolicyPath', () => {
  it('should include tier assignment policy', () => {
    const entry = createMockMemoryEntry({ tier: 'L2' });
    const policies = buildPolicyPath(entry, DEFAULT_TIER_CONFIG);

    const tierPolicy = policies.find((p) => p.policyName === 'tier-assignment');
    expect(tierPolicy).toBeDefined();
    expect(tierPolicy!.reason).toContain('L2');
  });

  it('should include context inclusion policy for L1/L2', () => {
    const l2Entry = createMockMemoryEntry({ tier: 'L2' });
    const policies = buildPolicyPath(l2Entry, DEFAULT_TIER_CONFIG);

    const contextPolicy = policies.find((p) => p.policyName === 'context-inclusion');
    expect(contextPolicy).toBeDefined();
    expect(contextPolicy!.action).toBe('include');
  });

  it('should include context exclusion policy for L3', () => {
    const l3Entry = createMockMemoryEntry({ tier: 'L3' });
    const policies = buildPolicyPath(l3Entry, DEFAULT_TIER_CONFIG);

    const contextPolicy = policies.find((p) => p.policyName === 'context-exclusion');
    expect(contextPolicy).toBeDefined();
    expect(contextPolicy!.action).toBe('exclude');
  });

  it('should include pin protection policy for pinned memories', () => {
    const pinnedEntry = createMockMemoryEntry({
      pinned: true,
      pinnedAt: new Date().toISOString(),
    });
    const policies = buildPolicyPath(pinnedEntry, DEFAULT_TIER_CONFIG);

    const pinPolicy = policies.find((p) => p.policyName === 'pin-protection');
    expect(pinPolicy).toBeDefined();
    expect(pinPolicy!.action).toBe('boost');
  });

  it('should include promotion/demotion history', () => {
    const promotedEntry = createMockMemoryEntry({
      tier: 'L1',
      promotedAt: new Date().toISOString(),
      previousTier: 'L2',
    });
    const policies = buildPolicyPath(promotedEntry, DEFAULT_TIER_CONFIG);

    const promotionPolicy = policies.find((p) => p.policyName === 'manual-promotion');
    expect(promotionPolicy).toBeDefined();
    expect(promotionPolicy!.reason).toContain('L2');
    expect(promotionPolicy!.reason).toContain('L1');
  });
});

describe('formatExplanationHuman', () => {
  it('should include all sections', () => {
    const entry = createMockMemoryEntry();
    const snapshot = createMockSnapshot(entry);
    const explanation = explainMemory(entry, snapshot);
    const formatted = formatExplanationHuman(explanation);

    expect(formatted).toContain('Memory Retrieval Explanation');
    expect(formatted).toContain('SCORE BREAKDOWN');
    expect(formatted).toContain('SOURCE TRACE');
    expect(formatted).toContain('POLICY PATH');
    expect(formatted).toContain(entry.id);
  });

  it('should include visual score bars', () => {
    const entry = createMockMemoryEntry();
    const snapshot = createMockSnapshot(entry);
    const explanation = explainMemory(entry, snapshot);
    const formatted = formatExplanationHuman(explanation);

    // Should contain visual bar characters
    expect(formatted).toMatch(/[█░]/);
  });
});

describe('formatExplanationMarkdown', () => {
  it('should output valid markdown', () => {
    const entry = createMockMemoryEntry();
    const snapshot = createMockSnapshot(entry);
    const explanation = explainMemory(entry, snapshot);
    const formatted = formatExplanationMarkdown(explanation);

    // Should have markdown headers
    expect(formatted).toContain('##');
    expect(formatted).toContain('###');

    // Should have markdown table
    expect(formatted).toContain('|');
    expect(formatted).toContain('---|');

    // Should have code formatting
    expect(formatted).toContain('`');
  });
});

describe('edge cases', () => {
  it('should handle memory without tier (backward compatibility)', () => {
    const legacyEntry = createMockMemoryEntry();
    delete (legacyEntry as any).tier;

    const snapshot = createMockSnapshot(legacyEntry);
    const explanation = explainMemory(legacyEntry, snapshot);

    // Should default to L3 for backward compatibility
    expect(explanation.scoreBreakdown.tierBoost).toBe(0.4); // L3 boost
  });

  it('should handle memory without timestamps', () => {
    const minimalEntry: MemoryEntry = {
      id: 'minimal-123',
      content: 'Minimal memory',
      source: 'test',
      createdAt: new Date().toISOString(),
    };

    const snapshot = createMockSnapshot(minimalEntry);
    const explanation = explainMemory(minimalEntry, snapshot);

    expect(explanation.compositeScore).toBeGreaterThan(0);
  });

  it('should handle empty query string', () => {
    const entry = createMockMemoryEntry();
    const snapshot = createMockSnapshot(entry);
    const explanation = explainMemory(entry, snapshot, { query: '' });

    // Empty query should be treated as no query
    expect(explanation.scoreBreakdown.relevanceScore).toBeDefined();
  });
});
