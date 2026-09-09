import { describe, expect, it } from 'vitest';
import {
  formatScheduleMissingJson,
  type ScheduleMissingJson,
} from '../schedule.js';

describe('savestate schedule --json when missing', () => {
  it('prints a missing schedule summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatScheduleMissingJson()) as ScheduleMissingJson & {
      platform?: unknown;
      intervalHours?: unknown;
      job?: unknown;
      path?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      enabled: false,
      running: false,
      supported: false,
    });
    expect(parsed.platform).toBeUndefined();
    expect(parsed.intervalHours).toBeUndefined();
    expect(parsed.job).toBeUndefined();
    expect(parsed.path).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'enabled',
      'found',
      'running',
      'supported',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
