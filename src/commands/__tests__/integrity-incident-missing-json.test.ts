import { describe, expect, it } from 'vitest';
import {
  formatIntegrityIncidentMissingJson,
  type IntegrityIncidentMissingJson,
} from '../integrity.js';

describe('savestate integrity incident --json when missing', () => {
  it('prints a missing incident summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityIncidentMissingJson('inc-123')) as IntegrityIncidentMissingJson & {
      events?: unknown;
      matched_content?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      id: 'inc-123',
      status: null,
      eventCount: 0,
    });
    expect(parsed.events).toBeUndefined();
    expect(parsed.matched_content).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['eventCount', 'found', 'id', 'status']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
