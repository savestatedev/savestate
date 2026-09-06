import { describe, expect, it } from 'vitest';
import type { MemoryTierConfig } from '../../types.js';
import {
  DEFAULT_TIER_CONFIG,
  formatMemoryConfigJson,
  type MemoryConfigJson,
} from '../memory.js';

const sparse: MemoryTierConfig = {
  version: '2.0.0',
  defaultTier: 'L3',
  tiers: {
    L1: { includeInContext: true },
    L2: { maxItems: 0, includeInContext: false },
    L3: { maxItems: null, maxAge: null, includeInContext: false },
  },
};

describe('savestate memory config --json', () => {
  it('prints tier limits and policy names as JSON', () => {
    const parsed = JSON.parse(formatMemoryConfigJson(DEFAULT_TIER_CONFIG)) as MemoryConfigJson & {
      tiers?: unknown;
    };
    expect(parsed).toEqual({
      version: '1.0.0',
      defaultTier: 'L2',
      l1MaxItems: 50,
      l1MaxAge: '24h',
      l1IncludeInContext: true,
      l2MaxItems: 500,
      l2MaxAge: '30d',
      l2IncludeInContext: true,
      l3MaxItems: null,
      l3MaxAge: null,
      l3IncludeInContext: false,
      policies: [
        {
          name: 'auto-demote-l1',
          trigger: 'age',
          from: 'L1',
          to: 'L2',
          threshold: '24h',
        },
        {
          name: 'auto-demote-l2',
          trigger: 'age',
          from: 'L2',
          to: 'L3',
          threshold: '30d',
        },
      ],
    });
    expect(parsed.tiers).toBeUndefined();
  });

  it('records missing limits and empty policies as null or []', () => {
    const parsed = JSON.parse(formatMemoryConfigJson(sparse)) as MemoryConfigJson;
    expect(parsed.version).toBe('2.0.0');
    expect(parsed.defaultTier).toBe('L3');
    expect(parsed.l1MaxItems).toBeNull();
    expect(parsed.l1MaxAge).toBeNull();
    expect(parsed.l1IncludeInContext).toBe(true);
    expect(parsed.l2MaxItems).toBe(0);
    expect(parsed.l2MaxAge).toBeNull();
    expect(parsed.l2IncludeInContext).toBe(false);
    expect(parsed.l3MaxItems).toBeNull();
    expect(parsed.l3MaxAge).toBeNull();
    expect(parsed.policies).toEqual([]);
  });
});
