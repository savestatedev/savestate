import { describe, expect, it } from 'vitest';
import {
  formatMemoryApplyPoliciesMissingJson,
  type MemoryApplyPoliciesMissingJson,
} from '../memory.js';

describe('savestate memory apply-policies --json when missing', () => {
  it('prints a missing snapshot summary as JSON without extra fields', () => {
    const parsed = JSON.parse(
      formatMemoryApplyPoliciesMissingJson('ss-missing'),
    ) as MemoryApplyPoliciesMissingJson & {
      changes?: unknown;
      dryRun?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      snapshot: 'ss-missing',
      applied: false,
      changeCount: 0,
    });
    expect(parsed.changes).toBeUndefined();
    expect(parsed.dryRun).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'applied',
      'changeCount',
      'found',
      'snapshot',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
