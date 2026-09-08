import { describe, expect, it } from 'vitest';
import {
  formatTrustDenyRemoveMissingJson,
  type TrustDenyRemoveMissingJson,
} from '../trust.js';

describe('savestate trust deny remove --json when missing', () => {
  it('prints a missing deny-remove summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatTrustDenyRemoveMissingJson('secret.env')) as TrustDenyRemoveMissingJson & {
      reason?: unknown;
      addedBy?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      pattern: 'secret.env',
      removed: 0,
    });
    expect(parsed.reason).toBeUndefined();
    expect(parsed.addedBy).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'pattern', 'removed']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
