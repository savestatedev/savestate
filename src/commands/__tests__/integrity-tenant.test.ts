import { describe, expect, it } from 'vitest';
import { parseIntegrityTenant } from '../integrity.js';

describe('savestate integrity --tenant', () => {
  it('defaults to undefined', () => {
    expect(parseIntegrityTenant(undefined)).toBeUndefined();
  });

  it('accepts a single tenant id', () => {
    expect(parseIntegrityTenant('default')).toBe('default');
    expect(parseIntegrityTenant('acme-prod')).toBe('acme-prod');
    expect(parseIntegrityTenant(' tenant-1 ')).toBe('tenant-1');
  });

  it.each(['', ' ', ',', 'acme,other', 'acme prod'])('rejects invalid value %s', (value) => {
    expect(() => parseIntegrityTenant(value)).toThrow(
      `Invalid --tenant value "${value}". Expected a single non-empty tenant id.`,
    );
  });
});
