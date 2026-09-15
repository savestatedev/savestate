import { describe, expect, it } from 'vitest';
import { parseMemoryReason } from '../memory-cli.js';

describe('savestate memory --reason', () => {
  it('accepts a non-empty reason', () => {
    expect(parseMemoryReason('stale')).toBe('stale');
    expect(parseMemoryReason('correction, then reindex')).toBe('correction, then reindex');
    expect(parseMemoryReason(' stale ')).toBe('stale');
  });

  it.each(['', ' '])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryReason(value)).toThrow(
      `Invalid --reason value "${value}". Expected a non-empty reason.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseMemoryReason(undefined)).toThrow(
      'Invalid --reason value. Expected a non-empty reason.',
    );
  });
});
