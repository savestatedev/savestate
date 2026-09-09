import { describe, expect, it } from 'vitest';
import {
  formatLoginMissingJson,
  type LoginMissingJson,
} from '../login.js';

describe('savestate login --json when missing', () => {
  it('prints a missing login summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatLoginMissingJson()) as LoginMissingJson & {
      features?: unknown;
      storageLimit?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      authenticated: false,
      email: null,
      tier: null,
    });
    expect(parsed.features).toBeUndefined();
    expect(parsed.storageLimit).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'authenticated',
      'email',
      'found',
      'tier',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
