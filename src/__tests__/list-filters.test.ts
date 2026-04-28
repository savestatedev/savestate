/**
 * Tests for applyListFilters — date / adapter / tag filtering.
 */

import { describe, it, expect } from 'vitest';
import { applyListFilters } from '../commands/list.js';
import type { SnapshotIndexEntry } from '../index-file.js';

function entry(partial: Partial<SnapshotIndexEntry>): SnapshotIndexEntry {
  return {
    id: partial.id ?? 'ss-x',
    timestamp: partial.timestamp ?? '2026-04-01T00:00:00Z',
    platform: partial.platform ?? 'claude',
    adapter: partial.adapter ?? 'claude-code',
    filename: partial.filename ?? 'ss-x.saf.enc',
    size: partial.size ?? 1024,
    label: partial.label,
    tags: partial.tags,
  };
}

describe('applyListFilters', () => {
  const all: SnapshotIndexEntry[] = [
    entry({ id: 'a', timestamp: '2026-03-01T00:00:00Z', adapter: 'claude-code', tags: ['work'] }),
    entry({ id: 'b', timestamp: '2026-04-01T00:00:00Z', adapter: 'claude-code', tags: ['personal'] }),
    entry({ id: 'c', timestamp: '2026-04-15T00:00:00Z', adapter: 'chatgpt', tags: ['work'] }),
    entry({ id: 'd', timestamp: '2026-05-01T00:00:00Z', adapter: 'gemini' }),
  ];

  it('returns all when no filters provided', () => {
    expect(applyListFilters(all, {})).toHaveLength(4);
  });

  it('filters by --since', () => {
    const out = applyListFilters(all, { since: '2026-04-01' });
    expect(out.map((s) => s.id)).toEqual(['b', 'c', 'd']);
  });

  it('filters by --until', () => {
    const out = applyListFilters(all, { until: '2026-04-01' });
    expect(out.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('filters by --adapter', () => {
    const out = applyListFilters(all, { adapter: 'claude-code' });
    expect(out.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('filters by --tag', () => {
    const out = applyListFilters(all, { tag: 'work' });
    expect(out.map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('combines filters as AND', () => {
    const out = applyListFilters(all, {
      since: '2026-04-01',
      adapter: 'chatgpt',
      tag: 'work',
    });
    expect(out.map((s) => s.id)).toEqual(['c']);
  });

  it('throws on invalid date input', () => {
    expect(() => applyListFilters(all, { since: 'not-a-date' })).toThrow(/Invalid date/);
  });
});
