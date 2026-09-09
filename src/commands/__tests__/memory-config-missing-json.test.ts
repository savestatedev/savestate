import { describe, expect, it } from 'vitest';
import {
  formatMemoryConfigMissingJson,
  type MemoryConfigMissingJson,
} from '../memory.js';

describe('savestate memory config --json when missing', () => {
  it('prints a missing snapshot summary as JSON without extra fields', () => {
    const parsed = JSON.parse(
      formatMemoryConfigMissingJson('ss-missing'),
    ) as MemoryConfigMissingJson & {
      policies?: unknown;
      l1MaxItems?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      snapshot: 'ss-missing',
      version: null,
      defaultTier: null,
    });
    expect(parsed.policies).toBeUndefined();
    expect(parsed.l1MaxItems).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'defaultTier',
      'found',
      'snapshot',
      'version',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
