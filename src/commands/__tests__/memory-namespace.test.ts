import { describe, expect, it } from 'vitest';
import { parseMemoryNamespace } from '../memory-cli.js';

describe('savestate memory --namespace', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryNamespace(undefined)).toBeUndefined();
  });

  it('accepts a single namespace', () => {
    expect(parseMemoryNamespace('org:app:agent')).toBe('org:app:agent');
    expect(parseMemoryNamespace('org:app:agent:user')).toBe('org:app:agent:user');
    expect(parseMemoryNamespace(' org:app:agent ')).toBe('org:app:agent');
  });

  it.each(['', ' ', ',', 'org:app:agent,other', 'org app:agent'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseMemoryNamespace(value)).toThrow(
        `Invalid --namespace value "${value}". Expected a single non-empty namespace (org:app:agent[:user]).`,
      );
    },
  );
});
