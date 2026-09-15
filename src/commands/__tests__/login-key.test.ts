import { describe, expect, it } from 'vitest';
import { parseLoginKey } from '../login.js';

describe('savestate login --key', () => {
  it('defaults to undefined', () => {
    expect(parseLoginKey(undefined)).toBeUndefined();
  });

  it('accepts a single API key', () => {
    expect(parseLoginKey('ss_live_abc')).toBe('ss_live_abc');
    expect(parseLoginKey('ss_live_example')).toBe('ss_live_example');
    expect(parseLoginKey(' ss_live_abc ')).toBe('ss_live_abc');
  });

  it.each(['', ' ', ',', 'ss_live_a,ss_live_b', 'ss_live_abc other'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseLoginKey(value)).toThrow(
        `Invalid --key value "${value}". Expected a single non-empty API key.`,
      );
    },
  );
});
