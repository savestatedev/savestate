/**
 * Tests for multi-tier memory architecture
 */

import { describe, it, expect } from 'vitest';
import {
  getEffectiveTier,
  normalizeMemoryEntry,
  normalizeMemory,
  filterByTier,
  getContextMemories,
  countByTier,
  promoteMemory,
  demoteMemory,
  pinMemory,
  unpinMemory,
  parseDuration,
  applyTierPolicies,
  DEFAULT_TIER_CONFIG,
} from '../memory.js';
import type { MemoryEntry, Memory } from '../../types.js';

describe('Memory Tier System', () => {
  const createEntry = (overrides: Partial<MemoryEntry> = {}): MemoryEntry => ({
    id: 'test-id-123',
    content: 'Test memory content',
    source: 'test',
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  describe('getEffectiveTier', () => {
    it('returns L3 for entries without tier', () => {
      const entry = createEntry();
      expect(getEffectiveTier(entry)).toBe('L3');
    });

    it('returns the actual tier when set', () => {
      const entry = createEntry({ tier: 'L1' });
      expect(getEffectiveTier(entry)).toBe('L1');
    });
  });

  describe('normalizeMemoryEntry', () => {
    it('adds L3 tier to entries without tier', () => {
      const entry = createEntry();
      const normalized = normalizeMemoryEntry(entry);
      expect(normalized.tier).toBe('L3');
    });

    it('preserves existing tier', () => {
      const entry = createEntry({ tier: 'L2' });
      const normalized = normalizeMemoryEntry(entry);
      expect(normalized.tier).toBe('L2');
    });
  });

  describe('normalizeMemory', () => {
    it('normalizes all core entries and adds default tier config', () => {
      const memory: Memory = {
        core: [createEntry(), createEntry({ id: 'second' })],
        knowledge: [],
      };
      const normalized = normalizeMemory(memory);

      expect(normalized.core.every((e) => e.tier === 'L3')).toBe(true);
      expect(normalized.tierConfig).toEqual(DEFAULT_TIER_CONFIG);
    });

    it('preserves existing tier config', () => {
      const customConfig = { ...DEFAULT_TIER_CONFIG, defaultTier: 'L1' as const };
      const memory: Memory = {
        core: [],
        knowledge: [],
        tierConfig: customConfig,
      };
      const normalized = normalizeMemory(memory);
      expect(normalized.tierConfig?.defaultTier).toBe('L1');
    });
  });

  describe('filterByTier', () => {
    it('filters memories by specified tier', () => {
      const memories = [
        createEntry({ id: '1', tier: 'L1' }),
        createEntry({ id: '2', tier: 'L2' }),
        createEntry({ id: '3', tier: 'L3' }),
        createEntry({ id: '4', tier: 'L1' }),
      ];

      const l1Only = filterByTier(memories, 'L1');
      expect(l1Only.length).toBe(2);
      expect(l1Only.every((m) => m.tier === 'L1')).toBe(true);
    });
  });

  describe('getContextMemories', () => {
    it('returns L1 and L2 memories by default', () => {
      const memories = [
        createEntry({ id: '1', tier: 'L1' }),
        createEntry({ id: '2', tier: 'L2' }),
        createEntry({ id: '3', tier: 'L3' }),
      ];

      const context = getContextMemories(memories);
      expect(context.length).toBe(2);
      expect(context.some((m) => m.tier === 'L3')).toBe(false);
    });
  });

  describe('countByTier', () => {
    it('correctly counts memories per tier', () => {
      const memories = [
        createEntry({ tier: 'L1' }),
        createEntry({ tier: 'L1' }),
        createEntry({ tier: 'L2' }),
        createEntry({ tier: 'L3' }),
        createEntry({ tier: 'L3' }),
        createEntry({ tier: 'L3' }),
      ];

      const counts = countByTier(memories);
      expect(counts).toEqual({ L1: 2, L2: 1, L3: 3 });
    });

    it('handles entries without tier as L3', () => {
      const memories = [createEntry(), createEntry(), createEntry({ tier: 'L1' })];
      const counts = countByTier(memories);
      expect(counts).toEqual({ L1: 1, L2: 0, L3: 2 });
    });
  });

  describe('promoteMemory', () => {
    it('promotes from L3 to L2', () => {
      const entry = createEntry({ tier: 'L3' });
      const promoted = promoteMemory(entry, 'L2');

      expect(promoted.tier).toBe('L2');
      expect(promoted.previousTier).toBe('L3');
      expect(promoted.promotedAt).toBeDefined();
    });

    it('promotes from L2 to L1', () => {
      const entry = createEntry({ tier: 'L2' });
      const promoted = promoteMemory(entry, 'L1');

      expect(promoted.tier).toBe('L1');
      expect(promoted.previousTier).toBe('L2');
    });

    it('throws when trying to promote to same or lower tier', () => {
      const entry = createEntry({ tier: 'L1' });
      expect(() => promoteMemory(entry, 'L2')).toThrow('Cannot promote');
      expect(() => promoteMemory(entry, 'L1')).toThrow('Cannot promote');
    });
  });

  describe('demoteMemory', () => {
    it('demotes from L1 to L2', () => {
      const entry = createEntry({ tier: 'L1' });
      const demoted = demoteMemory(entry, 'L2');

      expect(demoted.tier).toBe('L2');
      expect(demoted.previousTier).toBe('L1');
      expect(demoted.demotedAt).toBeDefined();
    });

    it('demotes from L2 to L3', () => {
      const entry = createEntry({ tier: 'L2' });
      const demoted = demoteMemory(entry, 'L3');

      expect(demoted.tier).toBe('L3');
      expect(demoted.previousTier).toBe('L2');
    });

    it('throws when trying to demote to same or higher tier', () => {
      const entry = createEntry({ tier: 'L3' });
      expect(() => demoteMemory(entry, 'L2')).toThrow('Cannot demote');
      expect(() => demoteMemory(entry, 'L3')).toThrow('Cannot demote');
    });

    it('throws when trying to demote pinned memory', () => {
      const entry = createEntry({ tier: 'L1', pinned: true });
      expect(() => demoteMemory(entry, 'L2')).toThrow('pinned');
    });
  });

  describe('pinMemory', () => {
    it('pins an unpinned memory', () => {
      const entry = createEntry();
      const pinned = pinMemory(entry);

      expect(pinned.pinned).toBe(true);
      expect(pinned.pinnedAt).toBeDefined();
    });

    it('returns same entry if already pinned', () => {
      const entry = createEntry({ pinned: true, pinnedAt: '2024-01-01T00:00:00Z' });
      const result = pinMemory(entry);

      expect(result).toBe(entry);
    });
  });

  describe('unpinMemory', () => {
    it('unpins a pinned memory', () => {
      const entry = createEntry({ pinned: true, pinnedAt: '2024-01-01T00:00:00Z' });
      const unpinned = unpinMemory(entry);

      expect(unpinned.pinned).toBe(false);
      expect(unpinned.pinnedAt).toBeUndefined();
    });

    it('returns same entry if already unpinned', () => {
      const entry = createEntry();
      const result = unpinMemory(entry);

      expect(result).toBe(entry);
    });
  });

  describe('parseDuration', () => {
    it('parses hours', () => {
      expect(parseDuration('24h')).toBe(24 * 60 * 60 * 1000);
    });

    it('parses days', () => {
      expect(parseDuration('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('parses weeks', () => {
      expect(parseDuration('2w')).toBe(2 * 7 * 24 * 60 * 60 * 1000);
    });

    it('parses months (30 days)', () => {
      expect(parseDuration('1m')).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('throws on invalid format', () => {
      expect(() => parseDuration('invalid')).toThrow('Invalid duration format');
      expect(() => parseDuration('24')).toThrow('Invalid duration format');
    });
  });

  describe('applyTierPolicies', () => {
    it('demotes old L1 entries to L2 based on age policy', () => {
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48h ago
      const memories = [createEntry({ id: '1', tier: 'L1', createdAt: oldDate })];

      const { updated, changes } = applyTierPolicies(memories, DEFAULT_TIER_CONFIG);

      expect(changes.length).toBe(1);
      expect(changes[0]).toMatchObject({
        entryId: '1',
        from: 'L1',
        to: 'L2',
        reason: 'age',
      });
      expect(updated[0].tier).toBe('L2');
    });

    it('skips pinned entries', () => {
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const memories = [createEntry({ id: '1', tier: 'L1', createdAt: oldDate, pinned: true })];

      const { updated, changes } = applyTierPolicies(memories, DEFAULT_TIER_CONFIG);

      expect(changes.length).toBe(0);
      expect(updated[0].tier).toBe('L1');
    });

    it('does not demote recent entries', () => {
      const recentDate = new Date().toISOString();
      const memories = [createEntry({ id: '1', tier: 'L1', createdAt: recentDate })];

      const { updated, changes } = applyTierPolicies(memories, DEFAULT_TIER_CONFIG);

      expect(changes.length).toBe(0);
      expect(updated[0].tier).toBe('L1');
    });
  });
});

describe('Backward Compatibility', () => {
  it('treats entries without tier as L3 for all operations', () => {
    const entry: MemoryEntry = {
      id: 'legacy-entry',
      content: 'Legacy content without tier',
      source: 'legacy-import',
      createdAt: '2024-01-01T00:00:00Z',
    };

    // Should be counted as L3
    const counts = countByTier([entry]);
    expect(counts.L3).toBe(1);

    // Should not be in context by default
    const context = getContextMemories([entry]);
    expect(context.length).toBe(0);

    // Can be promoted
    const promoted = promoteMemory(entry, 'L2');
    expect(promoted.tier).toBe('L2');
  });
});
