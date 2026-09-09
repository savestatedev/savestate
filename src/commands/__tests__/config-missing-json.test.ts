import { describe, expect, it } from 'vitest';
import {
  formatConfigMissingJson,
  type ConfigMissingJson,
} from '../config.js';

describe('savestate config --json when missing', () => {
  it('prints a missing config summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatConfigMissingJson()) as ConfigMissingJson & {
      adapters?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      version: null,
      storage: null,
      defaultAdapter: null,
    });
    expect(parsed.adapters).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'defaultAdapter',
      'found',
      'storage',
      'version',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
