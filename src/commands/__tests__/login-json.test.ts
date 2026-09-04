import { describe, expect, it } from 'vitest';
import { formatLoginResultJson, type LoginResult } from '../login.js';

const result: LoginResult = {
  authenticated: true,
  email: 'fixture@savestate.dev',
  tier: 'pro',
  features: 4,
  storageLimit: 10737418240,
};

describe('savestate login --json', () => {
  it('prints login metadata as JSON', () => {
    const parsed = JSON.parse(formatLoginResultJson(result)) as LoginResult & { apiKey?: string };
    expect(parsed.authenticated).toBe(true);
    expect(parsed.email).toBe('fixture@savestate.dev');
    expect(parsed.tier).toBe('pro');
    expect(parsed.features).toBe(4);
    expect(parsed.storageLimit).toBe(10737418240);
    expect(parsed.apiKey).toBeUndefined();
  });

  it('records a free account with no cloud storage', () => {
    const parsed = JSON.parse(
      formatLoginResultJson({
        authenticated: true,
        email: 'free@savestate.dev',
        tier: 'free',
        features: 0,
        storageLimit: 0,
      }),
    ) as LoginResult;
    expect(parsed.tier).toBe('free');
    expect(parsed.features).toBe(0);
    expect(parsed.storageLimit).toBe(0);
  });
});
