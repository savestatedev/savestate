import { describe, expect, it } from 'vitest';
import { parseMemorySnapshot } from '../memory-cli.js';

describe('savestate memory --snapshot', () => {
  it('defaults to undefined', () => {
    expect(parseMemorySnapshot(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot id', () => {
    expect(parseMemorySnapshot('ss-2026-09-14T12-00-00-ab12cd')).toBe(
      'ss-2026-09-14T12-00-00-ab12cd',
    );
    expect(parseMemorySnapshot(' abc123 ')).toBe('abc123');
  });

  it.each(['', ' ', ',', 'ss-1,ss-2', 'ss 1'])('rejects invalid value %s', (value) => {
    expect(() => parseMemorySnapshot(value)).toThrow(
      `Invalid --snapshot value "${value}". Expected a single non-empty snapshot id.`,
    );
  });
});
