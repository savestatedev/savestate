import { describe, expect, it } from 'vitest';
import { parseMemoryEditLimit } from '../memory-lifecycle.js';

describe('parseMemoryEditLimit', () => {
  it('accepts a decimal positive integer', () => {
    expect(parseMemoryEditLimit(' 25 ')).toBe(25);
  });

  it.each(['', '   ', '1e2', '0x10', '0', '1001'])('rejects non-decimal or out-of-range value %j', (value) => {
    expect(() => parseMemoryEditLimit(value)).toThrow(/Invalid --limit value/);
  });
});
