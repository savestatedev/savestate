import { describe, expect, it } from 'vitest';
import { MemorySearchInputSchema } from '../memory-search-schema.js';

describe('MCP memory search importance filter', () => {
  it('accepts importance thresholds from 0 through 1', () => {
    expect(MemorySearchInputSchema.parse({ minImportance: 0 }).minImportance).toBe(0);
    expect(MemorySearchInputSchema.parse({ minImportance: 1 }).minImportance).toBe(1);
  });

  it.each([-0.1, 1.1])('rejects out-of-range threshold %s', (minImportance) => {
    expect(() => MemorySearchInputSchema.parse({ minImportance })).toThrow();
  });
});
