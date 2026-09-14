import { describe, expect, it } from 'vitest';
import { parseAclId } from '../acl.js';

describe('savestate acl --id', () => {
  it('accepts a single commitment id', () => {
    expect(parseAclId('cmt-missing')).toBe('cmt-missing');
    expect(parseAclId('cmt-2026-09-14-ab12cd')).toBe('cmt-2026-09-14-ab12cd');
    expect(parseAclId(' abc123 ')).toBe('abc123');
  });

  it.each(['', ' ', ',', 'cmt-1,cmt-2', 'cmt 1'])('rejects invalid value %s', (value) => {
    expect(() => parseAclId(value)).toThrow(
      `Invalid --id value "${value}". Expected a single non-empty commitment id.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseAclId(undefined)).toThrow(
      'Invalid --id value. Expected a single non-empty commitment id.',
    );
  });
});
