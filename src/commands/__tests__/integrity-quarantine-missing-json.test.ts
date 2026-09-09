import { describe, expect, it } from 'vitest';
import {
  formatIntegrityQuarantineMissingJson,
  type IntegrityQuarantineMissingJson,
} from '../integrity.js';

describe('savestate integrity quarantine --json when missing', () => {
  it('prints a missing quarantine summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityQuarantineMissingJson()) as IntegrityQuarantineMissingJson & {
      tenantId?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      success: false,
      eventId: null,
    });
    expect(parsed.tenantId).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['eventId', 'found', 'success']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
