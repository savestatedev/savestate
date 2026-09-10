import { describe, expect, it } from 'vitest';
import {
  formatIdentitySchemaMissingJson,
  type IdentitySchemaMissingJson,
} from '../identity.js';

describe('savestate identity schema --json when missing', () => {
  it('prints a missing schema summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIdentitySchemaMissingJson()) as IdentitySchemaMissingJson & {
      required?: unknown;
      properties?: unknown;
      additionalProperties?: unknown;
      secret?: unknown;
      apiKey?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      id: null,
      title: null,
      type: null,
    });
    expect(parsed.required).toBeUndefined();
    expect(parsed.properties).toBeUndefined();
    expect(parsed.additionalProperties).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'id', 'title', 'type']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
