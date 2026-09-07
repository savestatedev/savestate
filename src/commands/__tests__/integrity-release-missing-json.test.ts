import { describe, expect, it } from 'vitest';
import {
  formatIntegrityReleaseMissingJson,
  type IntegrityReleaseMissingJson,
} from '../integrity.js';

describe('savestate integrity release --json when missing', () => {
  it('prints a missing release summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatIntegrityReleaseMissingJson('mem-123')) as IntegrityReleaseMissingJson & {
      event?: unknown;
      metadata?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      targetId: 'mem-123',
      success: false,
      eventId: null,
    });
    expect(parsed.event).toBeUndefined();
    expect(parsed.metadata).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['eventId', 'found', 'success', 'targetId']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
