import { describe, expect, it } from 'vitest';
import {
  formatIntegrityIncidentsMissingJson,
  type IntegrityIncidentsMissingJson,
} from '../integrity.js';

describe('savestate integrity incidents --json when missing', () => {
  it('prints a missing incidents summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityIncidentsMissingJson()) as IntegrityIncidentsMissingJson & {
      incidents?: unknown;
      events?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      total: 0,
      shown: 0,
    });
    expect(parsed.incidents).toBeUndefined();
    expect(parsed.events).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'shown', 'total']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
