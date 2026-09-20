import { describe, expect, it } from 'vitest';
import { parseIntegrityConfigSet } from '../integrity.js';

describe('savestate integrity config key=value', () => {
  it('defaults to undefined', () => {
    expect(parseIntegrityConfigSet(undefined)).toBeUndefined();
  });

  it('accepts a non-empty key=value pair', () => {
    expect(parseIntegrityConfigSet('enabled=true')).toEqual({ path: 'enabled', value: 'true' });
    expect(parseIntegrityConfigSet('honeyfact.count=10')).toEqual({
      path: 'honeyfact.count',
      value: '10',
    });
    expect(parseIntegrityConfigSet(' enabled = true ')).toEqual({ path: 'enabled', value: 'true' });
  });

  it.each(['', ' ', '=', 'enabled=', '=true', 'enabled', 'enabled = '])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseIntegrityConfigSet(value)).toThrow(
        `Invalid config setting "${value}". Expected a non-empty key=value pair.`,
      );
    },
  );
});
