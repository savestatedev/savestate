import { describe, expect, it } from 'vitest';
import {
  formatMemoryExpireMissingJson,
  type MemoryExpireMissingJson,
} from '../memory-lifecycle.js';

describe('savestate memory expire --json when missing', () => {
  it('prints a missing namespace summary as JSON without extra fields', () => {
    const parsed = JSON.parse(
      formatMemoryExpireMissingJson('org:missing'),
    ) as MemoryExpireMissingJson & {
      expiredIds?: unknown;
      dryRun?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      namespace: 'org:missing',
      applied: false,
      expiredCount: 0,
    });
    expect(parsed.expiredIds).toBeUndefined();
    expect(parsed.dryRun).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'applied',
      'expiredCount',
      'found',
      'namespace',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
