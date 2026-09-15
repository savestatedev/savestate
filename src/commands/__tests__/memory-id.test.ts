import { describe, expect, it } from 'vitest';
import { parseMemoryId } from '../memory-cli.js';

describe('savestate memory memory-id', () => {
  it('accepts a single memory id', () => {
    expect(parseMemoryId('mem-123')).toBe('mem-123');
    expect(parseMemoryId('abc123')).toBe('abc123');
    expect(parseMemoryId(' mem-123 ')).toBe('mem-123');
  });

  it.each(['', ' ', ',', 'mem-1,mem-2', 'mem 123'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryId(value)).toThrow(
      `Invalid memory id "${value}". Expected a single non-empty memory id.`,
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseMemoryId(undefined)).toThrow(
      'Invalid memory id. Expected a single non-empty memory id.',
    );
  });
});
