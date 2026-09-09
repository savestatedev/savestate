import { describe, expect, it } from 'vitest';
import {
  formatVerifyMissingJson,
  type VerifyMissingJson,
} from '../verify.js';

describe('savestate verify --json when missing', () => {
  it('prints a missing verify summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatVerifyMissingJson('missing.savestate')) as VerifyMissingJson & {
      checksum?: unknown;
      components?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      input: 'missing.savestate',
      valid: false,
      agent: null,
    });
    expect(parsed.checksum).toBeUndefined();
    expect(parsed.components).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['agent', 'found', 'input', 'valid']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
