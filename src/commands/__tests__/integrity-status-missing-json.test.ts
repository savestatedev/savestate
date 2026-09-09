import { describe, expect, it } from 'vitest';
import {
  formatIntegrityStatusMissingJson,
  type IntegrityStatusMissingJson,
} from '../integrity.js';

describe('savestate integrity status --json when missing', () => {
  it('prints a missing integrity status summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityStatusMissingJson()) as IntegrityStatusMissingJson & {
      containment?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      enabled: false,
      policy: null,
      honeyfacts: 0,
      incidents: 0,
    });
    expect(parsed.containment).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'enabled',
      'found',
      'honeyfacts',
      'incidents',
      'policy',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
