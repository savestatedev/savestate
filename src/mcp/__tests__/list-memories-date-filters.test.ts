import { describe, expect, it } from 'vitest';
import { parseListMemoriesDateFilters } from '../list-memories-date-filters.js';

describe('MCP list_memories creation-date filters', () => {
  it('normalizes inclusive date-only bounds', () => {
    expect(parseListMemoriesDateFilters({ since: '2026-10-01', until: '2026-10-31' })).toEqual({
      since: '2026-10-01T00:00:00.000Z',
      until: '2026-10-31T23:59:59.999Z',
    });
  });

  it('rejects an inverted range and invalid dates', () => {
    expect(() => parseListMemoriesDateFilters({ since: '2026-10-02', until: '2026-10-01' })).toThrow(
      'since must be at or before until',
    );
    expect(() => parseListMemoriesDateFilters({ since: '2026-02-30' })).toThrow('Invalid since value');
  });
});
