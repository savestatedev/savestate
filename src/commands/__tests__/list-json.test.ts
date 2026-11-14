import { describe, expect, it } from 'vitest';
import {
  formatListJson,
  formatListJsonSummary,
  formatListMissingJsonSummary,
  formatListPageSummary,
  normalizeListJsonLabel,
  normalizeListJsonFilters,
  normalizeListJsonTags,
  type ListJson,
} from '../list.js';
import type { SnapshotIndexEntry } from '../../index-file.js';

const older: SnapshotIndexEntry = {
  id: 'ss-older',
  timestamp: '2026-01-25T09:30:00.000Z',
  platform: 'claude-code',
  adapter: 'claude-code',
  filename: 'ss-older.saf.enc',
  size: 2048,
};

const newer: SnapshotIndexEntry = {
  id: 'ss-newer',
  timestamp: '2026-01-26T09:30:00.000Z',
  platform: 'claude-code',
  adapter: 'claude-code',
  label: 'pre-update',
  tags: ['weekly'],
  filename: 'ss-newer.saf.enc',
  size: 4096,
};

describe('savestate list --json', () => {
  it('prints snapshot records as JSON newest first', () => {
    const parsed = JSON.parse(formatListJson([older, newer])) as ListJson;
    expect(parsed.found).toBe(true);
    expect(parsed.total).toBe(2);
    expect(parsed.shown).toBe(2);
    expect(parsed.remaining).toBe(0);
    expect(parsed.emptyReason).toBeNull();
    expect(parsed.entries[0]?.id).toBe('ss-newer');
    expect(parsed.entries[0]?.label).toBe('pre-update');
    expect(parsed.entries[0]?.tags).toEqual(['weekly']);
    expect(parsed.entries[0]?.filename).toBe('ss-newer.saf.enc');
    expect(parsed.entries[0]?.size).toBe(4096);
    expect(parsed.entries[1]?.id).toBe('ss-older');
  });

  it('records missing label as null and missing tags as []', () => {
    const parsed = JSON.parse(formatListJson([older], 1)) as ListJson;
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]?.id).toBe('ss-older');
    expect(parsed.entries[0]?.label).toBeNull();
    expect(parsed.entries[0]?.tags).toEqual([]);
  });

  it('normalizes legacy tag whitespace for JSON consumers', () => {
    const parsed = JSON.parse(formatListJson([{
      ...newer,
      tags: [' weekly ', '  ', 'project ', 'weekly', 'PROJECT'],
    }])) as ListJson;

    expect(parsed.entries[0]?.tags).toEqual(['weekly', 'project']);
    expect(normalizeListJsonTags(undefined)).toEqual([]);
  });

  it('normalizes legacy label whitespace for JSON consumers', () => {
    const parsed = JSON.parse(formatListJson([{
      ...newer,
      label: '  pre-update  ',
    }])) as ListJson;

    expect(parsed.entries[0]?.label).toBe('pre-update');
    expect(normalizeListJsonLabel('  ')).toBeNull();
    expect(normalizeListJsonLabel(undefined)).toBeNull();
  });

  it('sorts excluded adapters for stable filter metadata', () => {
    expect(normalizeListJsonFilters({
      exclude: [' Gemini ', 'chatgpt', 'CHATGPT', 'claude-code'],
    }).exclude).toEqual(['chatgpt', 'claude-code', 'gemini']);
  });

  it('prints an empty array when there are no snapshots', () => {
    expect(JSON.parse(formatListJson([]))).toMatchObject({
      found: false,
      total: 0,
      shown: 0,
      emptyReason: 'collection',
      page: 1,
      totalPages: 0,
      entries: [],
    });
  });

  it('does not advertise navigation for an empty collection at a stale offset', () => {
    const parsed = JSON.parse(formatListJson([], 10, 20)) as ListJson;

    expect(parsed).toMatchObject({
      emptyReason: 'collection',
      offset: 20,
      hasPrevious: false,
      previousOffset: null,
      hasMore: false,
      nextOffset: null,
    });
  });

  it('supports oldest-first ordering for JSON consumers', () => {
    const parsed = JSON.parse(formatListJson([older, newer], 50, undefined, true)) as ListJson;
    expect(parsed.entries.map((snapshot) => snapshot.id)).toEqual(['ss-older', 'ss-newer']);
  });

  it('reverses same-timestamp ties for oldest-first pagination', () => {
    const sameTimestamp = [
      { ...older, id: 'ss-a', timestamp: '2026-01-25T09:30:00.000Z' },
      { ...older, id: 'ss-b', timestamp: '2026-01-25T09:30:00.000Z' },
    ];

    const newestFirst = JSON.parse(formatListJson(sameTimestamp)) as ListJson;
    const oldestFirst = JSON.parse(formatListJson(sameTimestamp, 50, undefined, true)) as ListJson;

    expect(newestFirst.entries.map((snapshot) => snapshot.id)).toEqual(['ss-a', 'ss-b']);
    expect(oldestFirst.entries.map((snapshot) => snapshot.id)).toEqual(['ss-b', 'ss-a']);
  });

  it('reports navigation metadata for bounded pages', () => {
    const parsed = JSON.parse(formatListJson([older, newer], 1, 1)) as ListJson;
    expect(parsed).toMatchObject({
      total: 2,
      shown: 1,
      remaining: 0,
      emptyReason: null,
      offset: 1,
      limit: 1,
      pageSize: 1,
      page: 2,
      totalPages: 2,
      previousPage: 1,
      nextPage: null,
      maxOffset: 1000,
      hasPrevious: true,
      previousOffset: 0,
      hasMore: false,
      nextOffset: null,
    });
    expect(parsed.entries[0]?.id).toBe('ss-older');
  });

  it('omits snapshot records from the JSON summary while preserving navigation', () => {
    const parsed = JSON.parse(formatListJsonSummary([older, newer], 1, 1)) as ListJson;

    expect(parsed).toMatchObject({
      found: true,
      total: 2,
      shown: 1,
      remaining: 0,
      offset: 1,
      limit: 1,
      previousPage: 1,
      nextPage: null,
      hasPrevious: true,
      hasMore: false,
    });
    expect(parsed).not.toHaveProperty('entries');
  });

  it('exposes page navigation alongside offsets', () => {
    const parsed = JSON.parse(formatListJson([older, newer], 1)) as ListJson;

    expect(parsed).toMatchObject({
      page: 1,
      totalPages: 2,
      previousPage: null,
      nextPage: 2,
      nextOffset: 1,
    });
  });

  it('does not read payload-only fields in summary mode', () => {
    const summarySnapshot = { ...newer } as SnapshotIndexEntry;
    Object.defineProperty(summarySnapshot, 'filename', {
      get: () => { throw new Error('summary mode should not load filenames'); },
    });
    Object.defineProperty(summarySnapshot, 'size', {
      get: () => { throw new Error('summary mode should not load sizes'); },
    });

    expect(() => formatListJsonSummary([summarySnapshot])).not.toThrow();
  });

  it('reports matching snapshots remaining after the visible page', () => {
    const parsed = JSON.parse(formatListJson([older, newer], 1)) as ListJson;

    expect(parsed).toMatchObject({
      total: 2,
      shown: 1,
      remaining: 1,
      offset: 0,
      hasMore: true,
      nextOffset: 1,
    });
  });

  it('does not advertise a next offset beyond the CLI ceiling', () => {
    const snapshots = Array.from({ length: 1_051 }, (_, index) => ({
      ...older,
      id: `ss-${index}`,
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, index % 60, index)).toISOString(),
    }));

    for (const formatter of [formatListJson, formatListJsonSummary]) {
      const parsed = JSON.parse(formatter(snapshots, 50, 1_000)) as ListJson;
      expect(parsed.shown).toBe(50);
      expect(parsed.remaining).toBe(1);
      expect(parsed.hasMore).toBe(false);
      expect(parsed.nextOffset).toBeNull();
    }
  });

  it('counts only pages reachable within the CLI offset ceiling', () => {
    const snapshots = Array.from({ length: 1_051 }, (_, index) => ({
      ...older,
      id: `ss-${index}`,
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, index % 60, index)).toISOString(),
    }));

    for (const formatter of [formatListJson, formatListJsonSummary]) {
      const parsed = JSON.parse(formatter(snapshots, 50)) as ListJson;
      expect(parsed.totalPages).toBe(21);
    }
  });

  it.each([0, 0.5, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    'normalizes invalid direct-call limits (%s) in both JSON modes',
    (limit) => {
      const full = JSON.parse(formatListJson([older, newer], limit)) as ListJson;
      const summary = JSON.parse(formatListJsonSummary([older, newer], limit)) as ListJson;

      expect(full).toMatchObject({ limit: 50, pageSize: 50, shown: 2, totalPages: 1 });
      expect(summary).toMatchObject({ limit: 50, pageSize: 50, shown: 2, totalPages: 1 });
    },
  );

  it('normalizes invalid limits for missing-snapshot JSON summaries', () => {
    const parsed = JSON.parse(formatListMissingJsonSummary(0, 50)) as ListJson;

    expect(parsed).toMatchObject({
      limit: 50,
      pageSize: 50,
      page: 2,
      totalPages: 0,
    });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1.5, 2.9])(
    'normalizes invalid direct-call offsets (%s)',
    (offset) => {
      const parsed = JSON.parse(formatListJson([older], 1, offset)) as ListJson;

      expect(parsed.offset).toBe(Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0);
      expect(Number.isFinite(parsed.page)).toBe(true);
    },
  );

  it.each([0, 0.5, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    'normalizes invalid page-summary limits (%s)',
    (limit) => {
      expect(formatListPageSummary(100, 2, 0, limit)).toBe(
        '(showing 2 of 100 after filters; offset 0; limit 50; next offset 2)',
      );
      expect(formatListPageSummary(100, 0, 100, limit)).toBe(
        '(no snapshots shown: offset 100 skips past 100 after filters; try --offset 50 to open the nearest available page)',
      );
    },
  );

  it('caps stale-page recovery offsets at the CLI ceiling', () => {
    const snapshots = Array.from({ length: 1_051 }, (_, index) => ({
      ...older,
      id: `ss-${index}`,
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, index % 60, index)).toISOString(),
    }));

    for (const formatter of [formatListJson, formatListJsonSummary]) {
      const parsed = JSON.parse(formatter(snapshots, 50, 1_051)) as ListJson;
      expect(parsed).toMatchObject({
        shown: 0,
        emptyReason: 'page',
        suggestedOffset: 1_000,
        previousOffset: 1_000,
      });
    }
  });

  it('keeps stale-page recovery offsets aligned to the page size', () => {
    const snapshots = Array.from({ length: 2_001 }, (_, index) => ({
      ...older,
      id: `ss-${index}`,
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, index % 60, index)).toISOString(),
    }));

    for (const formatter of [formatListJson, formatListJsonSummary]) {
      const parsed = JSON.parse(formatter(snapshots, 128, 2_001)) as ListJson;
      expect(parsed.suggestedOffset).toBe(896);
      expect(parsed.previousOffset).toBe(896);
    }
  });

  it('suggests the nearest page when an offset is past the filtered list', () => {
    const parsed = JSON.parse(formatListJson([older, newer], 1, 5)) as ListJson;

    expect(parsed).toMatchObject({
      found: false,
      total: 2,
      shown: 0,
      remaining: 0,
      emptyReason: 'page',
      offset: 5,
      hasMore: false,
      nextOffset: null,
      suggestedOffset: 1,
      previousOffset: 1,
    });
  });

  it('includes active filters for JSON consumers', () => {
    const parsed = JSON.parse(
      formatListJson([older], 50, undefined, false, {
        platform: 'chatgpt',
        exclude: ['claude-code'],
        label: 'weekly backup',
      }),
    ) as ListJson;

    expect(parsed.filters).toEqual({
      since: null,
      until: null,
      platform: 'chatgpt',
      adapter: null,
      exclude: ['claude-code'],
      snapshot: null,
      tag: null,
      label: 'weekly backup',
    });
  });

  it('normalizes filter metadata to the values used for matching', () => {
    expect(normalizeListJsonFilters({
      since: ' 2026-01-01 ',
      until: ' 2026-01-31T23:59:59Z ',
      platform: ' OpenAI ',
      adapter: ' ChatGPT ',
      exclude: [' Claude-Code ', ' ', 'claude-code'],
      snapshot: ' ss-1 ',
      tag: ' weekly ',
      label: ' pre-update ',
    })).toEqual({
      since: '2026-01-01',
      until: '2026-01-31T23:59:59Z',
      platform: 'openai',
      adapter: 'chatgpt',
      exclude: ['claude-code'],
      snapshot: 'ss-1',
      tag: 'weekly',
      label: 'pre-update',
    });
  });

  it('serializes blank filter values as null', () => {
    expect(normalizeListJsonFilters({
      since: '  ',
      until: '',
      platform: '  ',
      adapter: '',
      snapshot: '  ',
      tag: '',
      label: '   ',
    })).toMatchObject({
      since: null,
      until: null,
      platform: null,
      adapter: null,
      snapshot: null,
      tag: null,
      label: null,
    });
  });
});
