import { describe, expect, it } from 'vitest';
import type { MemoryEntry } from '../../types.js';
import {
  DEFAULT_MEMORY_FRESHNESS_PROFILES,
  getMemoryFreshness,
} from '../memory.js';

const now = new Date('2026-10-15T12:00:00.000Z');

function entry(partial: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: 'memory-1',
    content: 'content',
    source: 'test',
    createdAt: '2026-10-15T11:00:00.000Z',
    ...partial,
  };
}

describe('memory freshness profiles', () => {
  it('defines the starter TTLs from the freshness design', () => {
    expect(DEFAULT_MEMORY_FRESHNESS_PROFILES.fast).toMatchObject({
      softTtlSeconds: 6 * 60 * 60,
      hardTtlSeconds: 24 * 60 * 60,
      staleBehavior: 'hide',
    });
    expect(DEFAULT_MEMORY_FRESHNESS_PROFILES.static.softTtlSeconds).toBeNull();
  });

  it('marks a recently verified fast memory active', () => {
    expect(getMemoryFreshness(entry({
      freshnessClass: 'fast',
      lastVerifiedAt: '2026-10-15T10:00:00.000Z',
    }), now)).toMatchObject({
      class: 'fast',
      state: 'active',
      staleBehavior: 'hide',
    });
  });

  it('marks a memory stale after its soft TTL and requiring confirmation after its hard TTL', () => {
    expect(getMemoryFreshness(entry({
      freshnessClass: 'medium',
      lastVerifiedAt: '2026-10-08T11:00:00.000Z',
    }), now).state).toBe('stale');
    expect(getMemoryFreshness(entry({
      freshnessClass: 'medium',
      lastVerifiedAt: '2026-09-01T11:00:00.000Z',
    }), now).state).toBe('needs_confirmation');
  });

  it('fails closed for invalid verification timestamps', () => {
    expect(getMemoryFreshness(entry({ lastVerifiedAt: 'not-a-timestamp' }), now).state)
      .toBe('needs_confirmation');
  });
});
