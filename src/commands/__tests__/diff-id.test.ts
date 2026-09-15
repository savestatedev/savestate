import { describe, expect, it } from 'vitest';
import { parseDiffId } from '../diff.js';

describe('savestate diff snapshot-id', () => {
  it('accepts a single snapshot id', () => {
    expect(parseDiffId('latest')).toBe('latest');
    expect(parseDiffId('ss-2026-01-26T09-30-00-b7c1m4')).toBe(
      'ss-2026-01-26T09-30-00-b7c1m4',
    );
    expect(parseDiffId(' abc123 ')).toBe('abc123');
  });

  it.each(['', ' ', ',', 'ss-1,ss-2', 'ss 1'])('rejects invalid value %s', (value) => {
    expect(() => parseDiffId(value)).toThrow(
      `Invalid snapshot id "${value}". Expected a single non-empty snapshot id.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseDiffId(undefined)).toThrow(
      'Invalid snapshot id. Expected a single non-empty snapshot id.',
    );
  });
});
