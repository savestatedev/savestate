import { describe, expect, it } from 'vitest';
import { parseInspectId } from '../inspect.js';

describe('savestate inspect snapshot-id', () => {
  it('accepts a single snapshot id', () => {
    expect(parseInspectId('latest')).toBe('latest');
    expect(parseInspectId('ss-2026-01-26T09-30-00-b7c1m4')).toBe(
      'ss-2026-01-26T09-30-00-b7c1m4',
    );
    expect(parseInspectId(' abc123 ')).toBe('abc123');
  });

  it.each(['', ' ', ',', 'ss-1,ss-2', 'ss 1'])('rejects invalid value %s', (value) => {
    expect(() => parseInspectId(value)).toThrow(
      `Invalid snapshot id "${value}". Expected a single non-empty snapshot id.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseInspectId(undefined)).toThrow(
      'Invalid snapshot id. Expected a single non-empty snapshot id.',
    );
  });
});
