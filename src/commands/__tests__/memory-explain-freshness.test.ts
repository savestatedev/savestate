import { describe, expect, it } from 'vitest';
import {
  filterMemoryExplainEntries,
  formatMemoryExplainFilterMatches,
  formatMemoryExplainFilterSummary,
} from '../memory.js';

describe('savestate memory explain freshness filter', () => {
  it('keeps only memories in the requested freshness state', () => {
    const now = new Date('2026-10-18T00:00:00.000Z');
    const entries = [
      {
        id: 'active',
        content: 'editor preference',
        source: 'user',
        createdAt: '2026-10-17T23:00:00.000Z',
        freshnessClass: 'fast' as const,
        lastVerifiedAt: '2026-10-17T23:00:00.000Z',
      },
      {
        id: 'stale',
        content: 'editor preference',
        source: 'user',
        createdAt: '2026-10-17T12:00:00.000Z',
        freshnessClass: 'fast' as const,
        lastVerifiedAt: '2026-10-17T12:00:00.000Z',
      },
    ];

    expect(filterMemoryExplainEntries(entries, { freshness: 'active', now })).toEqual([entries[0]]);
    expect(filterMemoryExplainEntries(entries, { freshness: 'stale', now })).toEqual([entries[1]]);
  });

  it('summarizes the active freshness scope for pretty output', () => {
    expect(formatMemoryExplainFilterSummary({ freshness: 'needs_confirmation' })).toBe(
      'freshness=needs_confirmation',
    );
    expect(formatMemoryExplainFilterSummary()).toBeUndefined();
  });

  it('summarizes every active scope filter for pretty output', () => {
    expect(formatMemoryExplainFilterSummary({
      namespace: 'org:app:agent',
      source: 'chatgpt',
      tags: ['work', 'urgent'],
      freshness: 'active',
    })).toBe(
      'namespace=org:app:agent, source=chatgpt, tags=[work, urgent], freshness=active',
    );
  });

  it('reports every active scope filter in the explanation trace', () => {
    expect(formatMemoryExplainFilterMatches({
      namespace: 'org:app:agent',
      source: 'chatgpt',
      tags: ['work', 'urgent'],
      freshness: 'active',
      pinned: true,
    })).toEqual([
      'namespace=org:app:agent',
      'source=chatgpt',
      'tags=[work, urgent]',
      'freshness=active',
      'pinned=true',
    ]);
  });

  it('keeps only pinned memories when requested', () => {
    const entries = [
      { id: 'pinned', content: 'editor preference', source: 'user', createdAt: '2026-10-17T23:00:00.000Z', pinned: true },
      { id: 'unpinned', content: 'editor preference', source: 'user', createdAt: '2026-10-17T23:00:00.000Z', pinned: false },
    ];

    expect(filterMemoryExplainEntries(entries, { pinned: true })).toEqual([entries[0]]);
  });
});
