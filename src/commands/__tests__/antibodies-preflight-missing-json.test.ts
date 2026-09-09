import { describe, expect, it } from 'vitest';
import {
  formatAntibodiesPreflightMissingJson,
  type AntibodiesPreflightMissingJson,
} from '../antibodies.js';

describe('savestate antibodies preflight --json when missing', () => {
  it('prints a missing antibody preflight summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatAntibodiesPreflightMissingJson()) as AntibodiesPreflightMissingJson & {
      warnings?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      blocked: false,
      elapsedMs: 0,
      semanticUsed: false,
    });
    expect(parsed.warnings).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['blocked', 'elapsedMs', 'found', 'semanticUsed']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
