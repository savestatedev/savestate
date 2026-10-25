import { describe, expect, it } from 'vitest';
import {
  MemorySearchInputSchema,
  parseMemorySearchDateFilters,
} from '../memory-search-schema.js';

describe('MCP memory search date filters', () => {
  it('accepts a trimmed source metadata filter', () => {
    expect(MemorySearchInputSchema.parse({ source: '  Claude-Code ' }).source).toBe('Claude-Code');
  });

  it('rejects a blank source metadata filter', () => {
    expect(() => MemorySearchInputSchema.parse({ source: '   ' })).toThrow();
  });

  it('accepts inclusive ISO creation bounds on the shared search schema', () => {
    const parsed = MemorySearchInputSchema.parse({
      query: 'archive',
      since: '2026-10-01',
      until: '2026-10-31',
    });

    expect(parseMemorySearchDateFilters(parsed)).toEqual({
      since: '2026-10-01T00:00:00.000Z',
      until: '2026-10-31T23:59:59.999Z',
    });
  });

  it('rejects invalid or inverted creation bounds before querying', () => {
    expect(() => parseMemorySearchDateFilters({ since: '2026-02-30' })).toThrow(
      'Invalid since value',
    );
    expect(() => parseMemorySearchDateFilters({
      since: '2026-10-02',
      until: '2026-10-01',
    })).toThrow('since must be at or before until');
  });
});
