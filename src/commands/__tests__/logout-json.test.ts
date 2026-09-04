import { describe, expect, it } from 'vitest';
import { formatLogoutResultJson, type LogoutResult } from '../login.js';

describe('savestate logout --json', () => {
  it('prints logout status as JSON', () => {
    const parsed = JSON.parse(formatLogoutResultJson({ loggedOut: true, hadKey: true })) as LogoutResult & {
      apiKey?: string;
    };
    expect(parsed.loggedOut).toBe(true);
    expect(parsed.hadKey).toBe(true);
    expect(parsed.apiKey).toBeUndefined();
  });

  it('records a logout when no key was saved', () => {
    const parsed = JSON.parse(
      formatLogoutResultJson({ loggedOut: true, hadKey: false }),
    ) as LogoutResult;
    expect(parsed.loggedOut).toBe(true);
    expect(parsed.hadKey).toBe(false);
  });
});
