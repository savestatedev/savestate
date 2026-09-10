import { describe, expect, it } from 'vitest';
import {
  formatIdentityInitMissingJson,
  type IdentityInitMissingJson,
} from '../identity.js';

describe('savestate identity init --json when missing', () => {
  it('prints a missing init summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIdentityInitMissingJson('MyAgent')) as IdentityInitMissingJson & {
      tools?: unknown;
      secret?: unknown;
      apiKey?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      created: false,
      alreadyExists: false,
      path: null,
      name: 'MyAgent',
      version: null,
    });
    expect(parsed.tools).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'alreadyExists',
      'created',
      'found',
      'name',
      'path',
      'version',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
