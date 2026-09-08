import { describe, expect, it } from 'vitest';
import {
  formatContextValidateMissingJson,
  type ContextValidateMissingJson,
} from '../context.js';

describe('savestate context validate --json when missing', () => {
  it('prints a missing RunBrief summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatContextValidateMissingJson('brief.json')) as ContextValidateMissingJson & {
      coverage?: unknown;
      tokenCount?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      file: 'brief.json',
      valid: false,
      errors: [],
      warnings: [],
    });
    expect(parsed.coverage).toBeUndefined();
    expect(parsed.tokenCount).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual([
      'errors',
      'file',
      'found',
      'valid',
      'warnings',
    ]);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
