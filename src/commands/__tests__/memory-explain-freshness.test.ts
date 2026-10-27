import { describe, expect, it } from 'vitest';
import {
  filterMemoryExplainEntries,
  formatMemoryExplainFilterMatches,
  formatMemoryExplainFilterSummary,
} from '../memory.js';

describe('savestate memory explain freshness filter', () => {
  it('keeps only memories in the requested tier', () => {
    const entries = [
      { id: 'l1', content: 'editor preference', source: 'user', createdAt: '2026-10-17T23:00:00.000Z', tier: 'L1' as const },
      { id: 'l2', content: 'editor preference', source: 'user', createdAt: '2026-10-17T23:00:00.000Z', tier: 'L2' as const },
    ];

    expect(filterMemoryExplainEntries(entries, { tier: 'L1' })).toEqual([entries[0]]);
  });

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

  it('keeps only memories containing the requested content', () => {
    const entries = [
      { id: 'match', content: 'Preferred editor: Vim', source: 'user', createdAt: '2026-10-17T23:00:00.000Z' },
      { id: 'other', content: 'Preferred terminal: zsh', source: 'user', createdAt: '2026-10-17T23:00:00.000Z' },
    ];

    expect(filterMemoryExplainEntries(entries, { content: 'EDITOR: VIM' })).toEqual([entries[0]]);
  });

  it('summarizes the active freshness scope for pretty output', () => {
    expect(formatMemoryExplainFilterSummary({ freshness: 'needs_confirmation' })).toBe(
      'freshness=needs_confirmation',
    );
    expect(formatMemoryExplainFilterSummary()).toBeUndefined();
  });

  it('summarizes every active scope filter for pretty output', () => {
    expect(formatMemoryExplainFilterSummary({
      tier: 'L1',
      namespace: 'org:app:agent',
      source: 'chatgpt',
      content: 'editor',
      tags: ['work', 'urgent'],
      freshness: 'active',
    })).toBe(
      'tier=L1, namespace=org:app:agent, source=chatgpt, content=editor, tags=[work, urgent], freshness=active',
    );
  });

  it('reports every active scope filter in the explanation trace', () => {
    expect(formatMemoryExplainFilterMatches({
      tier: 'L1',
      namespace: 'org:app:agent',
      source: 'chatgpt',
      content: 'editor',
      tags: ['work', 'urgent'],
      freshness: 'active',
      pinned: true,
    })).toEqual([
      'tier=L1',
      'namespace=org:app:agent',
      'source=chatgpt',
      'content=editor',
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

  it('keeps only unpinned memories when requested', () => {
    const entries = [
      { id: 'pinned', content: 'editor preference', source: 'user', createdAt: '2026-10-17T23:00:00.000Z', pinned: true },
      { id: 'unpinned', content: 'editor preference', source: 'user', createdAt: '2026-10-17T23:00:00.000Z', pinned: false },
    ];

    expect(filterMemoryExplainEntries(entries, { pinned: false })).toEqual([entries[1]]);
  });

  it('keeps only memories in the requested importance range', () => {
    const entries = [
      { id: 'high', content: 'editor preference', source: 'user', createdAt: '2026-10-17T23:00:00.000Z', metadata: { importance: 0.9 } },
      { id: 'default', content: 'editor preference', source: 'user', createdAt: '2026-10-17T23:00:00.000Z' },
      { id: 'low', content: 'editor preference', source: 'user', createdAt: '2026-10-17T23:00:00.000Z', metadata: { importance: 0.2 } },
    ];

    expect(filterMemoryExplainEntries(entries, { minImportance: 0.5, maxImportance: 0.9 })).toEqual([
      entries[0],
      entries[1],
    ]);
  });

  it('reports importance filters in human-readable matches', () => {
    expect(formatMemoryExplainFilterMatches({ minImportance: 0.8, maxImportance: 1 })).toEqual([
      'minImportance=0.8',
      'maxImportance=1',
    ]);
  });
});
