import { describe, expect, it } from 'vitest';
import { parseMemoryDemoteTo } from '../memory-cli.js';

describe('savestate memory demote --to', () => {
  it('accepts known demotion tiers', () => {
    expect(parseMemoryDemoteTo('L2')).toBe('L2');
    expect(parseMemoryDemoteTo('l3')).toBe('L3');
    expect(parseMemoryDemoteTo(' L2 ')).toBe('L2');
  });

  it.each(['', ' ', 'nope', 'L1', 'l1', '1', 'hot'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryDemoteTo(value)).toThrow(
      `Invalid --to value "${value}". Expected one of: L2, L3.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseMemoryDemoteTo(undefined)).toThrow(
      'Invalid --to value. Expected one of: L2, L3.',
    );
  });
});
