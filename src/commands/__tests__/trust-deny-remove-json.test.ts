import { describe, expect, it } from 'vitest';
import { formatTrustDenyRemoveJson, type TrustDenyRemoveJson } from '../trust.js';

const result: TrustDenyRemoveJson & { secret?: string } = {
  pattern: 'secret.env',
  removed: 1,
  secret: 'ss_live_SECRET',
};

describe('savestate trust deny remove --json', () => {
  it('prints a deny-remove summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatTrustDenyRemoveJson(result)) as TrustDenyRemoveJson & {
      secret?: unknown;
      apiKey?: string;
    };
    expect(parsed).toEqual({
      pattern: 'secret.env',
      removed: 1,
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records a miss without extra fields', () => {
    const parsed = JSON.parse(
      formatTrustDenyRemoveJson({
        pattern: 'ssn:*',
        removed: 0,
      }),
    ) as TrustDenyRemoveJson;
    expect(parsed.pattern).toBe('ssn:*');
    expect(parsed.removed).toBe(0);
    expect(Object.keys(parsed).sort()).toEqual(['pattern', 'removed']);
  });
});
