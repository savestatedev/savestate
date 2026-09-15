import { describe, expect, it } from 'vitest';
import { parseConfigSet } from '../config.js';

describe('savestate config --set', () => {
  it('defaults to undefined', () => {
    expect(parseConfigSet(undefined)).toBeUndefined();
  });

  it('accepts a non-empty key=value pair', () => {
    expect(parseConfigSet('storage.type=s3')).toEqual({ path: 'storage.type', value: 's3' });
    expect(parseConfigSet('defaultAdapter=claude-code')).toEqual({
      path: 'defaultAdapter',
      value: 'claude-code',
    });
    expect(parseConfigSet(' storage.type = s3 ')).toEqual({ path: 'storage.type', value: 's3' });
  });

  it.each(['', ' ', '=', 'storage.type=', '=s3', 'storage.type', 'storage.type = '])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseConfigSet(value)).toThrow(
        `Invalid --set value "${value}". Expected a non-empty key=value pair.`,
      );
    },
  );
});
