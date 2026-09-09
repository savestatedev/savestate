import { describe, expect, it } from 'vitest';
import {
  formatAntibodiesAddMissingJson,
  type AntibodiesAddMissingJson,
} from '../antibodies.js';

describe('savestate antibodies add --json when missing', () => {
  it('prints a missing antibody add summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatAntibodiesAddMissingJson()) as AntibodiesAddMissingJson & {
      risk?: unknown;
      safeAction?: unknown;
      confidence?: unknown;
      apiKey?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      added: false,
      id: null,
    });
    expect(parsed.risk).toBeUndefined();
    expect(parsed.safeAction).toBeUndefined();
    expect(parsed.confidence).toBeUndefined();
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['added', 'found', 'id']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
