import { describe, expect, it } from 'vitest';
import {
  formatIntegritySeedMissingJson,
  type IntegritySeedMissingJson,
} from '../integrity.js';

describe('savestate integrity seed --json when missing', () => {
  it('prints a missing seed summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegritySeedMissingJson()) as IntegritySeedMissingJson & {
      tenantId?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      count: 0,
    });
    expect(parsed.tenantId).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['count', 'found']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
