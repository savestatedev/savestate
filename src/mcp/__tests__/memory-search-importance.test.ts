import { describe, expect, it } from 'vitest';
import { MemorySearchInputSchema } from '../memory-search-schema.js';

describe('MCP memory search importance filter', () => {
  it('accepts importance thresholds from 0 through 1', () => {
    expect(MemorySearchInputSchema.parse({ minImportance: 0 }).minImportance).toBe(0);
    expect(MemorySearchInputSchema.parse({ minImportance: 1 }).minImportance).toBe(1);
    expect(MemorySearchInputSchema.parse({ maxImportance: 0 }).maxImportance).toBe(0);
    expect(MemorySearchInputSchema.parse({ maxImportance: 1 }).maxImportance).toBe(1);
  });

  it.each([
    ['minImportance', -0.1],
    ['minImportance', 1.1],
    ['maxImportance', -0.1],
    ['maxImportance', 1.1],
  ])('rejects out-of-range threshold %s=%s', (field, value) => {
    expect(() => MemorySearchInputSchema.parse({ [field]: value })).toThrow();
  });

  it('rejects an inverted importance range', () => {
    expect(() => MemorySearchInputSchema.parse({ minImportance: 0.9, maxImportance: 0.2 }))
      .toThrow('minImportance must be at or below maxImportance');
  });

  it('accepts an inclusive importance range', () => {
    expect(MemorySearchInputSchema.parse({ minImportance: 0.2, maxImportance: 0.9 }))
      .toMatchObject({ minImportance: 0.2, maxImportance: 0.9 });
  });
});
