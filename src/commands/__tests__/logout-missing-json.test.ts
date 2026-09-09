import { describe, expect, it } from 'vitest';
import {
  formatLogoutMissingJson,
  type LogoutMissingJson,
} from '../login.js';

describe('savestate logout --json when missing', () => {
  it('prints a missing logout summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatLogoutMissingJson()) as LogoutMissingJson & {
      email?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      loggedOut: false,
      hadKey: false,
    });
    expect(parsed.email).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'found',
      'hadKey',
      'loggedOut',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
