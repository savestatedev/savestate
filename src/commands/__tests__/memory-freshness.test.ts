import { describe, expect, it } from 'vitest';
import type { MemoryEntry } from '../../types.js';
import {
  DEFAULT_MEMORY_FRESHNESS_PROFILES,
  filterMemoryListByFreshness,
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

  it('falls back for freshness classes inherited from the profile prototype', () => {
    expect(getMemoryFreshness(entry({
      freshnessClass: 'toString' as MemoryEntry['freshnessClass'],
    }), now)).toMatchObject({
      class: 'slow',
      softTtlSeconds: 30 * 24 * 60 * 60,
      hardTtlSeconds: 180 * 24 * 60 * 60,
    });
  });

  it('falls back for malformed TTL overrides from imported archive metadata', () => {
    expect(getMemoryFreshness(entry({
      freshnessClass: 'medium',
      softTtlSeconds: -1,
      hardTtlSeconds: Number.POSITIVE_INFINITY,
      lastVerifiedAt: '2026-10-15T11:00:00.000Z',
    }), now)).toMatchObject({
      softTtlSeconds: 7 * 24 * 60 * 60,
      hardTtlSeconds: 30 * 24 * 60 * 60,
      state: 'active',
    });
  });

  it('falls back for unknown stale behaviors from imported archive metadata', () => {
    expect(getMemoryFreshness(entry({
      freshnessClass: 'fast',
      staleBehavior: 'allow' as MemoryEntry['staleBehavior'],
    }), now).staleBehavior).toBe('hide');
  });

  it('filters list results by resolved freshness state', () => {
    const entries = [
      entry({ id: 'active', freshnessClass: 'fast', lastVerifiedAt: '2026-10-15T10:00:00.000Z' }),
      entry({ id: 'stale', freshnessClass: 'medium', lastVerifiedAt: '2026-10-08T11:00:00.000Z' }),
      entry({ id: 'confirm', freshnessClass: 'medium', lastVerifiedAt: '2026-09-01T11:00:00.000Z' }),
    ];

    expect(filterMemoryListByFreshness(entries, 'stale', now).map(({ id }) => id)).toEqual(['stale']);
    expect(filterMemoryListByFreshness(entries, 'needs_confirmation', now).map(({ id }) => id))
      .toEqual(['confirm']);
  });
});
