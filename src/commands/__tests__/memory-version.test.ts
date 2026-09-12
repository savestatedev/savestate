import { describe, expect, it } from 'vitest';
import { parseMemoryVersion } from '../memory-cli.js';

describe('savestate memory rollback --version', () => {
  it('accepts positive integers', () => {
    expect(parseMemoryVersion('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryVersion(value)).toThrow(
      `Invalid --version value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded rollback version', () => {
    expect(parseMemoryVersion('1000')).toBe(1000);
    expect(() => parseMemoryVersion('1001')).toThrow(
      'Invalid --version value "1001". Expected a positive integer up to 1000.',
    );
  });
});
