import { describe, expect, it } from 'vitest';
import {
  formatMemoryExplainMissingJson,
  type MemoryExplainMissingJson,
} from '../memory.js';

describe('savestate memory explain --json when missing', () => {
  it('prints a missing memory explanation as JSON without extra fields', () => {
    const parsed = JSON.parse(
      formatMemoryExplainMissingJson('inbox preference'),
    ) as MemoryExplainMissingJson & {
      results?: unknown;
      content?: unknown;
      previous_content?: unknown;
      secret?: unknown;
    };
    expect(parsed).toEqual({
      found: false,
      query: 'inbox preference',
      shown: 0,
      pagination: {
        offset: 0,
        limit: null,
        total: 0,
        pageSize: 1,
        hasMore: false,
        nextOffset: null,
      },
      results: null,
    });
    expect(parsed.content).toBeUndefined();
    expect(parsed.previous_content).toBeUndefined();
    expect(parsed.secret).toBeUndefined();
    expect(Object.keys(parsed).sort()).toEqual(['found', 'pagination', 'query', 'results', 'shown']);
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });
});
