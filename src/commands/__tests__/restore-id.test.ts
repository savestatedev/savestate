import { describe, expect, it } from 'vitest';
import { parseRestoreId } from '../restore.js';

describe('savestate restore snapshot-id', () => {
  it('defaults to latest', () => {
    expect(parseRestoreId(undefined)).toBe('latest');
  });

  it('accepts a single snapshot id', () => {
    expect(parseRestoreId('latest')).toBe('latest');
    expect(parseRestoreId('ss-2026-01-26T09-30-00-b7c1m4')).toBe(
      'ss-2026-01-26T09-30-00-b7c1m4',
    );
    expect(parseRestoreId(' abc123 ')).toBe('abc123');
  });

  it.each(['', ' ', ',', 'ss-1,ss-2', 'ss 1'])('rejects invalid value %s', (value) => {
    expect(() => parseRestoreId(value)).toThrow(
      `Invalid snapshot id "${value}". Expected a single non-empty snapshot id.`,
    );
  });
});
