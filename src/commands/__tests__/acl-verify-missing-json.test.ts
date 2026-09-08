import { describe, expect, it } from 'vitest';
import {
  formatAclVerifyMissingJson,
  type AclVerifyMissingJson,
} from '../acl.js';

describe('savestate acl verify --json when missing', () => {
  it('prints a missing commitment summary as JSON without extra fields', () => {
    const parsed = JSON.parse(formatAclVerifyMissingJson('cmt-missing')) as AclVerifyMissingJson & {
      auditTrail?: unknown;
      description?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      id: 'cmt-missing',
      state: null,
      verifier: null,
    });
    expect(parsed.auditTrail).toBeUndefined();
    expect(parsed.description).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'id', 'state', 'verifier']);
  });
});
