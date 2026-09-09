import { describe, expect, it } from 'vitest';
import {
  formatDoctorMissingJson,
  type DoctorMissingJson,
} from '../doctor.js';

describe('savestate doctor --json when missing', () => {
  it('prints a missing doctor summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatDoctorMissingJson()) as DoctorMissingJson & {
      results?: unknown;
      passphrase?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      total: 0,
      healthy: 0,
      unhealthy: 0,
    });
    expect(parsed.results).toBeUndefined();
    expect(parsed.passphrase).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'found',
      'healthy',
      'total',
      'unhealthy',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
