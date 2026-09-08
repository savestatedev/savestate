import { describe, expect, it } from 'vitest';
import {
  formatIdentitySetMissingJson,
  type IdentitySetMissingJson,
} from '../identity.js';

describe('savestate identity set --json when missing', () => {
  it('prints a missing identity set summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIdentitySetMissingJson('tone')) as IdentitySetMissingJson & {
      tools?: unknown;
      metadata?: unknown;
      secret?: unknown;
      value?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      updated: false,
      field: 'tone',
      name: null,
      version: null,
    });
    expect(parsed.tools).toBeUndefined();
    expect(parsed.metadata).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(parsed.value).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['field', 'found', 'name', 'updated', 'version']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
