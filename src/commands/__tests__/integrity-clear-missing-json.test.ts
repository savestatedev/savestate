import { describe, expect, it } from 'vitest';
import {
  formatIntegrityClearMissingJson,
  type IntegrityClearMissingJson,
} from '../integrity.js';

describe('savestate integrity clear --json when missing', () => {
  it('prints a missing clear summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityClearMissingJson()) as IntegrityClearMissingJson & {
      tenantId?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      cleared: 0,
    });
    expect(parsed.tenantId).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['cleared', 'found']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
