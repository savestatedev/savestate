import { describe, expect, it } from 'vitest';
import { parseMemoryPromoteTo } from '../memory-cli.js';

describe('savestate memory promote --to', () => {
  it('accepts known promotion tiers', () => {
    expect(parseMemoryPromoteTo('L1')).toBe('L1');
    expect(parseMemoryPromoteTo('l2')).toBe('L2');
    expect(parseMemoryPromoteTo(' L1 ')).toBe('L1');
  });

  it.each(['', ' ', 'nope', 'L3', 'l3', '1', 'archive'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryPromoteTo(value)).toThrow(
      `Invalid --to value "${value}". Expected one of: L1, L2.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseMemoryPromoteTo(undefined)).toThrow(
      'Invalid --to value. Expected one of: L1, L2.',
    );
  });
});
