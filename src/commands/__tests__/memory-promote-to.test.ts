import { describe, expect, it } from 'vitest';
import { parseMemoryPromoteTo } from '../memory-cli.js';
import {
  parseMemoryDemoteLimit,
  parseMemoryDemoteOffset,
  parseMemoryPromoteLimit,
  parseMemoryPromoteOffset,
} from '../memory.js';

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

describe('memory promote/demote pagination', () => {
  it('accepts surrounding whitespace around numeric values', () => {
    expect(parseMemoryPromoteLimit(' 12 ')).toBe(12);
    expect(parseMemoryPromoteOffset('\t3\n')).toBe(3);
    expect(parseMemoryDemoteLimit(' 4 ')).toBe(4);
    expect(parseMemoryDemoteOffset(' 5 ')).toBe(5);
  });
});
