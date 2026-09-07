import { describe, expect, it } from 'vitest';
import { formatTrustDenyAddJson, type TrustDenyAddJson } from '../trust.js';

const result: TrustDenyAddJson & { secret?: string } = {
  added: 'secret.env',
  reason: 'contains credentials',
  addedBy: 'cli',
  secret: 'ss_live_SECRET',
};

describe('savestate trust deny add --json', () => {
  it('prints a deny-add summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatTrustDenyAddJson(result)) as TrustDenyAddJson & {
      secret?: unknown;
      apiKey?: string;
    };
    expect(parsed).toEqual({
      added: 'secret.env',
      reason: 'contains credentials',
      addedBy: 'cli',
    });
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records default reason and actor without extra fields', () => {
    const parsed = JSON.parse(
      formatTrustDenyAddJson({
        added: 'ssn:*',
        reason: 'no reason given',
        addedBy: 'cli',
      }),
    ) as TrustDenyAddJson;
    expect(parsed.added).toBe('ssn:*');
    expect(parsed.reason).toBe('no reason given');
    expect(parsed.addedBy).toBe('cli');
    expect(Object.keys(parsed).sort()).toEqual(['added', 'addedBy', 'reason']);
  });
});
