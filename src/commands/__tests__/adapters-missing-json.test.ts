import { describe, expect, it } from 'vitest';
import {
  formatAdaptersMissingJson,
  type AdaptersMissingJson,
} from '../adapters.js';

describe('savestate adapters --json when missing', () => {
  it('prints a missing adapter list as JSON without extra fields', () => {
    const parsed = JSON.parse(formatAdaptersMissingJson()) as AdaptersMissingJson & {
      adapters?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      total: 0,
    });
    expect(parsed.adapters).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'total']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
