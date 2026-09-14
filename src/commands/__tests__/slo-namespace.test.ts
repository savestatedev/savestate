import { describe, expect, it } from 'vitest';
import { parseSloNamespace } from '../slo.js';

describe('savestate slo --namespace', () => {
  it('defaults to undefined', () => {
    expect(parseSloNamespace(undefined)).toBeUndefined();
  });

  it('accepts a single namespace', () => {
    expect(parseSloNamespace('org:app:agent')).toBe('org:app:agent');
    expect(parseSloNamespace('org:app:agent:user')).toBe('org:app:agent:user');
    expect(parseSloNamespace(' org:app:agent ')).toBe('org:app:agent');
  });

  it.each(['', ' ', ',', 'org:app:agent,other', 'org app:agent'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseSloNamespace(value)).toThrow(
        `Invalid --namespace value "${value}". Expected a single non-empty namespace (org:app:agent[:user]).`,
      );
    },
  );
});
