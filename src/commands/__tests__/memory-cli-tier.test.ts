import { describe, expect, it } from 'vitest';
import { parseMemoryTier } from '../memory-cli.js';

describe('memory tier CLI parsing', () => {
  it('accepts tiers case-insensitively', () => {
    expect(parseMemoryTier('l2')).toBe('L2');
  });

  it('reports the accepted values for invalid tiers', () => {
    expect(() => parseMemoryTier('archive')).toThrow(
      'Invalid memory tier "archive". Expected one of L1, L2, or L3.',
    );
  });

  it('leaves omitted optional filters unset', () => {
    expect(parseMemoryTier(undefined)).toBeUndefined();
  });

  it('rejects empty mutation targets instead of passing them downstream', () => {
    expect(() => parseMemoryTier('')).toThrow(
      'Invalid memory tier "". Expected one of L1, L2, or L3.',
    );
  });
});
