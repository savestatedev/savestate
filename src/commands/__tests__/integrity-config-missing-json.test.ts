import { describe, expect, it } from 'vitest';
import {
  formatIntegrityConfigMissingJson,
  type IntegrityConfigMissingJson,
} from '../integrity.js';

describe('savestate integrity config --json when missing', () => {
  it('prints a missing config summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityConfigMissingJson()) as IntegrityConfigMissingJson & {
      tenantId?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      enabled: false,
    });
    expect(parsed.tenantId).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['enabled', 'found']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
