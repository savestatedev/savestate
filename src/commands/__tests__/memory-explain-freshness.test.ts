import { describe, expect, it } from 'vitest';
import { filterMemoryExplainEntries } from '../memory.js';

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
});
