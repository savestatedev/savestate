import { describe, expect, it } from 'vitest';
import {
  formatIntegrityRotateMissingJson,
  type IntegrityRotateMissingJson,
} from '../integrity.js';

describe('savestate integrity rotate --json when missing', () => {
  it('prints a missing rotation summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityRotateMissingJson()) as IntegrityRotateMissingJson & {
      tenantId?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      rotated: 0,
      valid: 0,
      createdCount: 0,
      retiredCount: 0,
    });
    expect(parsed.tenantId).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'createdCount',
      'found',
      'retiredCount',
      'rotated',
      'valid',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
