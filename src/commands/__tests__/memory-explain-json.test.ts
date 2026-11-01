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
          createdAt: '2026-10-17T12:00:00.000Z',
          score: 0.82,
          summary: 'Strong match for "inbox preference" in active short-term memory.',
          pinned: true,
          tier: 'L1',
          freshness: 'active',
        },
        {
          id: 'mem-456',
          createdAt: '2026-10-16T08:30:00.000Z',
          score: 0.41,
          summary: 'Partial match for query in working memory.',
          pinned: false,
          tier: 'L2',
          freshness: 'stale',
        },
      ]),
    ) as MemoryExplainJson & {
      content?: unknown;
      previous_content?: unknown;
      results: Array<MemoryExplainJson['results'][number] & { content?: unknown }>;
    };
    expect(parsed).toEqual({
      found: true,
      query: 'inbox preference',
      shown: 2,
      emptyReason: null,
      suggestedOffset: null,
      pagination: {
        offset: 0,
        limit: null,
        total: 2,
        remaining: 0,
        pageSize: 2,
        hasPrevious: false,
        previousOffset: null,
        hasMore: false,
        nextOffset: null,
      },
      results: [
        {
          id: 'mem-123',
          createdAt: '2026-10-17T12:00:00.000Z',
          score: 0.82,
          summary: 'Strong match for "inbox preference" in active short-term memory.',
          namespace: null,
          pinned: true,
          tier: 'L1',
          freshness: 'active',
        },
        {
          id: 'mem-456',
          createdAt: '2026-10-16T08:30:00.000Z',
          score: 0.41,
          summary: 'Partial match for query in working memory.',
          namespace: null,
          pinned: false,
          tier: 'L2',
          freshness: 'stale',
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
      found: true,
      query: 'unknown query',
      shown: 0,
      emptyReason: 'collection',
      suggestedOffset: null,
      pagination: {
        offset: 0,
        limit: null,
        total: 0,
        remaining: 0,
        pageSize: 1,
        hasPrevious: false,
        previousOffset: null,
        hasMore: false,
        nextOffset: null,
      },
      results: [],
    });
  });

  it('does not advertise a previous page for an empty collection with an offset', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson(
        'unknown query',
        [],
        { offset: 10, limit: 5, total: 0 },
      ),
    ) as MemoryExplainJson;

    expect(parsed.pagination).toMatchObject({
      offset: 10,
      total: 0,
      hasPrevious: false,
      previousOffset: null,
      hasMore: false,
      nextOffset: null,
    });
  });

  it('reports continuation metadata for a paged result', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson(
        'inbox preference',
        [{ id: 'mem-3', score: 0.4, summary: 'Another match.', pinned: false, tier: 'L3', freshness: 'needs_confirmation' }],
        { offset: 2, limit: 1, total: 4 },
      ),
    ) as MemoryExplainJson;

    expect(parsed.pagination).toEqual({
      offset: 2,
      limit: 1,
      total: 4,
      remaining: 1,
      pageSize: 1,
      hasPrevious: true,
      previousOffset: 1,
      hasMore: true,
      nextOffset: 3,
    });
  });

  it('keeps an empty offset page distinct from no matching memories', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson(
        'inbox preference',
        [],
        { offset: 4, limit: 2, total: 4 },
      ),
    ) as MemoryExplainJson & { found?: unknown };

    expect(parsed).toEqual({
      found: true,
      query: 'inbox preference',
      shown: 0,
      emptyReason: 'page',
      suggestedOffset: 2,
      pagination: {
        offset: 4,
        limit: 2,
        total: 4,
        remaining: 0,
        pageSize: 2,
        hasPrevious: true,
        previousOffset: 2,
        hasMore: false,
        nextOffset: null,
      },
      results: [],
    });
    expect(parsed.found).toBe(true);
  });

  it('points exhausted bounded pages to the nearest populated page', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson(
        'inbox preference',
        [],
        { offset: 100, limit: 20, total: 45 },
      ),
    ) as MemoryExplainJson;

    expect(parsed.suggestedOffset).toBe(40);
    expect(parsed.pagination.previousOffset).toBe(40);
  });

  it('includes an active freshness filter for JSON consumers', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson(
        'inbox preference',
        [],
        { total: 0 },
        { freshness: 'needs_confirmation' },
      ),
    ) as MemoryExplainJson;

    expect(parsed.filters).toEqual({ freshness: 'needs_confirmation' });
  });

  it('includes the freshness profile and verification timestamp when provided', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson('inbox preference', [{
        id: 'mem-123',
        score: 0.82,
        summary: 'Strong match for "inbox preference" in active short-term memory.',
        pinned: true,
        tier: 'L1',
        freshness: 'stale',
        freshnessClass: 'fast',
        lastVerifiedAt: '2026-10-17T12:00:00.000Z',
        verificationSource: 'operator-review',
      }]),
    ) as MemoryExplainJson;

    expect(parsed.results[0]).toMatchObject({
      freshness: 'stale',
      freshnessClass: 'fast',
      lastVerifiedAt: '2026-10-17T12:00:00.000Z',
      verificationSource: 'operator-review',
    });
  });

  it('normalizes padding in verification sources', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson('inbox preference', [{
        id: 'mem-123',
        score: 0.82,
        summary: 'Strong match for the query.',
        pinned: false,
        tier: 'L1',
        freshness: 'active',
        verificationSource: ' profile\t sync ',
      }]),
    ) as MemoryExplainJson;

    expect(parsed.results[0]?.verificationSource).toBe('profile sync');
  });

  it('includes normalized tags when a result carries tag metadata', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson('inbox preference', [{
        id: 'mem-tagged',
        score: 0.82,
        summary: 'Tagged match for the query.',
        pinned: false,
        tier: 'L2',
        freshness: 'active',
        tags: ['Work', 'urgent'],
      }]),
    ) as MemoryExplainJson;

    expect(parsed.results[0]?.tags).toEqual(['Work', 'urgent']);
  });

  it('omits tags when metadata normalizes to an empty list', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson('inbox preference', [{
        id: 'mem-empty-tags',
        score: 0.82,
        summary: 'Match with blank tag metadata.',
        pinned: false,
        tier: 'L2',
        freshness: 'active',
        tags: [' ', ''],
      }]),
    ) as MemoryExplainJson;

    expect(parsed.results[0]).not.toHaveProperty('tags');
  });

  it('includes the effective importance used by ranking when provided', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson('inbox preference', [{
        id: 'mem-123',
        score: 0.82,
        importance: 0.9,
        summary: 'High-importance match.',
        pinned: false,
        tier: 'L2',
        freshness: 'active',
      }]),
    ) as MemoryExplainJson;

    expect(parsed.results[0]?.importance).toBe(0.9);
  });

  it('includes the effective criticality used by ranking when provided', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson('inbox preference', [{
        id: 'mem-123',
        score: 0.82,
        criticality: 0.9,
        summary: 'High-criticality match.',
        pinned: false,
        tier: 'L1',
        freshness: 'active',
      }]),
    ) as MemoryExplainJson;

    expect(parsed.results[0]?.criticality).toBe(0.9);
  });

  it('includes score components for agent-readable retrieval explanations', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson('inbox preference', [{
        id: 'mem-123',
        score: 0.82,
        scoreBreakdown: {
          semanticSimilarity: 0.8,
          recencyDecay: 0.7,
          importance: 0.9,
          taskCriticality: 0.6,
          confidenceBoost: 1,
        },
        summary: 'Strong match for the query.',
        pinned: false,
        tier: 'L1',
        freshness: 'active',
      }]),
    ) as MemoryExplainJson;

    expect(parsed.results[0]?.scoreBreakdown).toEqual({
      semanticSimilarity: 0.8,
      recencyDecay: 0.7,
      importance: 0.9,
      taskCriticality: 0.6,
      confidenceBoost: 1,
    });
  });

  it('includes a normalized source id for retrieval tracing', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson('inbox preference', [{
        id: 'mem-123',
        score: 0.82,
        source: ' Chat\t GPT ',
        summary: 'Strong match for the query.',
        pinned: false,
        tier: 'L1',
        freshness: 'active',
      }]),
    ) as MemoryExplainJson;

    expect(parsed.results[0]?.source).toBe('Chat GPT');
  });

  it('includes a trimmed namespace for retrieval tracing', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson('inbox preference', [{
        id: 'mem-123',
        score: 0.82,
        namespace: '  work:mail:assistant  ',
        summary: 'Strong match for the query.',
        pinned: false,
        tier: 'L1',
        freshness: 'active',
      }]),
    ) as MemoryExplainJson;

    expect(parsed.results[0]?.namespace).toBe('work:mail:assistant');
  });

  it('includes every active scope filter for JSON consumers', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson(
        'inbox preference',
        [],
        {},
        {
          tier: 'L1',
          namespace: 'org:app:agent',
          source: 'chatgpt',
          content: 'editor',
          tags: ['work', 'urgent'],
          freshness: 'active',
          pinned: true,
        },
      ),
    ) as MemoryExplainJson;

    expect(parsed.filters).toEqual({
      tier: 'L1',
      namespace: 'org:app:agent',
      source: 'chatgpt',
      content: 'editor',
      tags: ['work', 'urgent'],
      freshness: 'active',
      pinned: true,
    });
  });

  it('includes the resolved snapshot when provided', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson(
        'inbox preference',
        [],
        { total: 0 },
        undefined,
        'ss-2026-10-18',
      ),
    ) as MemoryExplainJson;

    expect(parsed.snapshot).toBe('ss-2026-10-18');
  });

  it('normalizes padded source ids in explain filters', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson(
        'inbox preference',
        [],
        {},
        { source: '  Claude-Code  ' },
      ),
    ) as MemoryExplainJson;

    expect(parsed.filters?.source).toBe('Claude-Code');
  });

  it('normalizes padded namespaces in explain filters', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson(
        'inbox preference',
        [],
        {},
        { namespace: '  work:mail:assistant  ' },
      ),
    ) as MemoryExplainJson;

    expect(parsed.filters?.namespace).toBe('work:mail:assistant');
  });

  it('canonicalizes explain tag filters for JSON consumers', () => {
    const parsed = JSON.parse(
      formatMemoryExplainJson(
        'inbox preference',
        [],
        {},
        { tags: [' Work ', 'work', '', 'Urgent'] },
      ),
    ) as MemoryExplainJson;

    expect(parsed.filters?.tags).toEqual(['Work', 'Urgent']);
  });
});
