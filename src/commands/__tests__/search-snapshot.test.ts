import { describe, expect, it } from 'vitest';
import { parseSearchSnapshot } from '../search.js';

describe('savestate search --snapshot', () => {
  it('defaults to undefined', () => {
    expect(parseSearchSnapshot(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot id', () => {
    expect(parseSearchSnapshot('ss-2026-09-13T12-00-00-ab12cd')).toBe(
      'ss-2026-09-13T12-00-00-ab12cd',
    );
    expect(parseSearchSnapshot(' abc123 ')).toBe('abc123');
  });

  it.each(['', ' ', ',', 'ss-1,ss-2', 'ss 1'])('rejects invalid value %s', (value) => {
    expect(() => parseSearchSnapshot(value)).toThrow(
      `Invalid --snapshot value "${value}". Expected a single non-empty snapshot id.`,
    );
  });
});
