import { describe, expect, it } from 'vitest';
import {
  formatIdentityShowMissingJson,
  type IdentityShowMissingJson,
} from '../identity.js';

describe('savestate identity show --json when missing', () => {
  it('prints a missing identity summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIdentityShowMissingJson()) as IdentityShowMissingJson & {
      tools?: unknown;
      metadata?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      name: null,
      version: null,
      schemaVersion: null,
    });
    expect(parsed.tools).toBeUndefined();
    expect(parsed.metadata).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'name', 'schemaVersion', 'version']);
  });
});
