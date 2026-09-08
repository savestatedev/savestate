import { describe, expect, it } from 'vitest';
import {
  formatInspectMissingJson,
  type InspectMissingJson,
} from '../inspect.js';

describe('savestate inspect --json when missing', () => {
  it('prints a missing snapshot summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatInspectMissingJson('ss-missing')) as InspectMissingJson & {
      counts?: unknown;
      adapter?: unknown;
      filename?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      id: 'ss-missing',
      timestamp: null,
      platform: null,
      hasIdentity: false,
    });
    expect(parsed.counts).toBeUndefined();
    expect(parsed.adapter).toBeUndefined();
    expect(parsed.filename).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'found',
      'hasIdentity',
      'id',
      'platform',
      'timestamp',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
