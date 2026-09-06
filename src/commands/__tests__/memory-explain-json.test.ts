import { describe, expect, it } from 'vitest';
import {
  formatMemoryExplainJson,
  type MemoryExplainJson,
} from '../memory.js';

describe('savestate memory explain --json', () => {
  it('prints retrieval scores and summaries as JSON without content', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson('inbox preference', [
        {
          id: 'mem-123',
          score: 0.82,
          summary: 'Strong match for "inbox preference" in active short-term memory.',
        },
        {
          id: 'mem-456',
          score: 0.41,
          summary: 'Partial match for query in working memory.',
        },
      ]),
    ) as MemoryExplainJson & {
      content?: unknown;
      previous_content?: unknown;
      results: Array<MemoryExplainJson['results'][number] & { content?: unknown }>;
    };
    expect(parsed).toEqual({
      query: 'inbox preference',
      shown: 2,
      results: [
        {
          id: 'mem-123',
          score: 0.82,
          summary: 'Strong match for "inbox preference" in active short-term memory.',
        },
        {
          id: 'mem-456',
          score: 0.41,
          summary: 'Partial match for query in working memory.',
        },
      ],
    });
    expect(parsed.content).toBeUndefined();
    expect(parsed.previous_content).toBeUndefined();
    expect(parsed.results[0]?.content).toBeUndefined();
  });

  it('records no matches as an empty list', () => {
    const parsed = JSON.parse(formatMemoryExplainJson('unknown query', [])) as MemoryExplainJson;
    expect(parsed).toEqual({
      query: 'unknown query',
      shown: 0,
      results: [],
    });
  });
});
