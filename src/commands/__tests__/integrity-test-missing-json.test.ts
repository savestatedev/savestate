import { describe, expect, it } from 'vitest';
import {
  formatIntegrityTestMissingJson,
  type IntegrityTestMissingJson,
} from '../integrity.js';

describe('savestate integrity test --json when missing', () => {
  it('prints a missing test summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityTestMissingJson()) as IntegrityTestMissingJson & {
      tenantId?: unknown;
      apiKey?: unknown;
      secret?: unknown;
      events?: unknown;
      matchedContent?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      triggered: false,
      eventCount: 0,
      incidentId: null,
    });
    expect(parsed.tenantId).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(parsed.events).toBeUndefined();
    expect(parsed.matchedContent).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['eventCount', 'found', 'incidentId', 'triggered']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
