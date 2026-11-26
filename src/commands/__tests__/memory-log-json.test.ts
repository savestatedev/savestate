import { describe, expect, it } from 'vitest';
import type { ProvenanceEntry } from '../../checkpoint/types.js';
import {
  formatMemoryLogEmptyPage,
  formatMemoryLogJson,
  formatMemoryLogActionSummary,
  formatMemoryLogNavigation,
  resolveMemoryLogNavigationOffset,
  formatMemoryLogTablePageSummary,
  getMemoryLogGuidance,
  filterMemoryLogAction,
  parseMemoryLogAction,
  parseMemoryLogActions,
  parseMemoryLogSince,
  parseMemoryLogUntil,
  filterMemoryLogDateRange,
  type MemoryLogJson,
} from '../memory-lifecycle.js';

const created: ProvenanceEntry = {
  action: 'created',
  actor_id: 'user-1',
  timestamp: '2026-09-05T12:00:00.000Z',
};

const edited: ProvenanceEntry = {
  action: 'edited',
  actor_id: 'editor-1',
  timestamp: '2026-09-05T12:05:00.000Z',
  reason: 'Fixed typo',
  version: 2,
  previous_content: 'ss_live_SECRET preference',
};

const merged: ProvenanceEntry = {
  action: 'merged',
  actor_id: 'system',
  timestamp: '2026-09-05T12:10:00.000Z',
  checkpoint_id: 'ckpt-9',
  merged_from: ['mem-a', 'mem-b'],
};

describe('savestate memory log --json', () => {
  it('normalizes and validates action filters', () => {
    expect(parseMemoryLogAction('  EDITED ')).toBe('edited');
    expect(parseMemoryLogAction(' rollback ')).toBe('rolled_back');
    expect(parseMemoryLogAction(undefined)).toBeUndefined();
    expect(() => parseMemoryLogAction('edit events')).toThrow('Invalid --action value');
  });

  it('accepts comma-separated action filters without duplicates', () => {
    expect(parseMemoryLogActions(' EDITED, created,rollback,rolled_back ')).toEqual([
      'edited',
      'created',
      'rolled_back',
    ]);
    expect(() => parseMemoryLogActions('edited,,created')).toThrow('Invalid --action value');
  });

  it('filters audit events before pagination', () => {
    expect(filterMemoryLogAction([created, edited, merged], 'edited')).toEqual([edited]);
    expect(filterMemoryLogAction([created, edited, merged], ['edited', 'merged'])).toEqual([edited, merged]);
    expect(filterMemoryLogAction([created, edited, merged], ['EDITED', 'MERGED'])).toEqual([edited, merged]);
    expect(filterMemoryLogAction([created, edited], undefined)).toHaveLength(2);
  });

  it('filters audit events by inclusive ISO date boundaries', () => {
    expect(parseMemoryLogSince('2026-09-05')).toBe('2026-09-05T00:00:00.000Z');
    expect(parseMemoryLogUntil('2026-09-05')).toBe('2026-09-05T23:59:59.999Z');
    expect(filterMemoryLogDateRange([created, edited, merged], '2026-09-05T12:05:00.000Z', undefined))
      .toEqual([edited, merged]);
    expect(() => parseMemoryLogSince('not-a-date')).toThrow('Invalid --since value');
    expect(() => filterMemoryLogDateRange([], '2026-09-06T00:00:00.000Z', '2026-09-05T00:00:00.000Z'))
      .toThrow('must be on or before');
  });

  it('formats a deterministic action summary for table output', () => {
    expect(formatMemoryLogActionSummary([merged, created, edited, created])).toBe(
      'Action summary: created 2, edited 1, merged 1',
    );
    expect(formatMemoryLogActionSummary([])).toBe('Action summary: none');
  });

  it('normalizes action counts to match case-insensitive filters', () => {
    expect(formatMemoryLogActionSummary([
      { ...edited, action: 'EDITED' },
      edited,
    ])).toBe('Action summary: edited 2');
  });

  it('shows page metadata in table pagination summaries', () => {
    expect(formatMemoryLogTablePageSummary(2, 7, 5, 5)).toBe(
      'Showing 2 of 7 entries (page 2 of 2, offset 5, limit 5)',
    );
    expect(formatMemoryLogTablePageSummary(0, 0, 0, 5)).toBe(
      'Showing 0 of 0 entries (page 1 of 1, offset 0, limit 5)',
    );
    expect(formatMemoryLogTablePageSummary(3, 3, 0, null)).toBe(
      'Showing 3 of 3 entries (offset 0)',
    );
  });

  it('keeps table navigation in page mode when requested', () => {
    expect(formatMemoryLogNavigation('next', 10, 5, true)).toBe('Next page: use --page 3.');
    expect(formatMemoryLogNavigation('previous', 5, 5, true)).toBe('Previous page: use --page 2.');
    expect(formatMemoryLogNavigation('next', 10, 5, false)).toBe('Next page: use --offset 10.');
    expect(resolveMemoryLogNavigationOffset('next', 3, 5)).toBe(8);
    expect(resolveMemoryLogNavigationOffset('previous', 3, 5)).toBe(0);
  });

  it('supports a metadata-only summary without audit events', () => {
    const parsed = JSON.parse(formatMemoryLogJson('mem-123', [created], {
      includeEvents: false,
      total: 3,
      shown: 1,
      limit: 1,
      hasMore: true,
      nextOffset: 1,
      actionLog: [created, edited, merged],
    })) as MemoryLogJson & { eventsIncluded: boolean };

    expect(parsed.events).toEqual([]);
    expect(parsed.eventsIncluded).toBe(false);
    expect(parsed.actionCounts).toEqual({ created: 1, edited: 1, merged: 1 });
    expect(parsed.pagination).toMatchObject({ total: 3, shown: 1, hasMore: true, nextOffset: 1 });
  });

  it('prints audit events as JSON without previous content', () => {
    const parsed = JSON.parse(formatMemoryLogJson('mem-123', [created, edited, merged])) as MemoryLogJson & {
      events: Array<MemoryLogJson['events'][number] & { previous_content?: unknown; actor_id?: unknown }>;
    };
    expect(parsed).toEqual({
      found: true,
      memoryId: 'mem-123',
      eventsIncluded: true,
      actionCounts: { created: 1, edited: 1, merged: 1 },
      events: [
        {
          action: 'created',
          actorId: 'user-1',
          timestamp: '2026-09-05T12:00:00.000Z',
          reason: null,
          version: null,
          checkpointId: null,
          mergedFrom: [],
        },
        {
          action: 'edited',
          actorId: 'editor-1',
          timestamp: '2026-09-05T12:05:00.000Z',
          reason: 'Fixed typo',
          version: 2,
          checkpointId: null,
          mergedFrom: [],
        },
        {
          action: 'merged',
          actorId: 'system',
          timestamp: '2026-09-05T12:10:00.000Z',
          reason: null,
          version: null,
          checkpointId: 'ckpt-9',
          mergedFrom: ['mem-a', 'mem-b'],
        },
      ],
      guidance: { action: 'none', offset: 0 },
      pagination: {
        offset: 0,
        limit: null,
        page: 1,
        totalPages: 1,
        total: 3,
        shown: 3,
        hasMore: false,
        nextOffset: null,
        previousOffset: null,
        emptyReason: null,
        suggestedOffset: null,
      },
    });
    expect(parsed.events[1]?.previous_content).toBeUndefined();
    expect(parsed.events[1]?.actor_id).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('ss_live_SECRET');
  });

  it('records an empty audit log', () => {
    const parsed = JSON.parse(formatMemoryLogJson('mem-missing', [])) as MemoryLogJson;
    expect(parsed.memoryId).toBe('mem-missing');
    expect(parsed.events).toEqual([]);
  });

  it('keeps an empty bounded audit log on its first page', () => {
    const parsed = JSON.parse(formatMemoryLogJson('mem-missing', [], {
      limit: 5,
      total: 0,
      shown: 0,
    })) as MemoryLogJson;

    expect(parsed.pagination.page).toBe(1);
    expect(parsed.pagination.totalPages).toBe(1);
    expect(parsed.pagination.emptyReason).toBe('collection');
  });

  it('advances by the page size when a sparse page still has matches', () => {
    const parsed = JSON.parse(formatMemoryLogJson('mem-123', [created], {
      offset: 0,
      limit: 2,
      total: 5,
      shown: 1,
      hasMore: true,
    })) as MemoryLogJson;

    expect(parsed.pagination.nextOffset).toBe(2);
    expect(parsed.guidance).toEqual({ action: 'next', offset: 2 });
  });

  it('describes an exhausted page without exposing previous content', () => {
    const parsed = JSON.parse(formatMemoryLogJson('mem-123', [], {
      offset: 10,
      limit: 5,
      total: 3,
      shown: 0,
      emptyReason: 'page',
      suggestedOffset: 0,
    })) as MemoryLogJson;

    expect(parsed.pagination).toEqual({
      offset: 10,
      limit: 5,
      page: 3,
      totalPages: 1,
      total: 3,
      shown: 0,
      hasMore: false,
      nextOffset: null,
      previousOffset: 5,
      emptyReason: 'page',
      suggestedOffset: 0,
    });
    expect(parsed.guidance).toEqual({ action: 'retry', offset: 0 });
  });

  it('selects the previous page when the log is exhausted without a suggested page', () => {
    expect(getMemoryLogGuidance({
      offset: 5,
      previousOffset: 0,
      nextOffset: null,
      hasMore: false,
    }, null)).toEqual({ action: 'previous', offset: 0 });
  });

  it('does not advertise a next page beyond the CLI offset ceiling', () => {
    const parsed = JSON.parse(formatMemoryLogJson('mem-123', [created], {
      offset: 1000,
      limit: 5,
      total: 2000,
      shown: 1,
      hasMore: true,
      nextOffset: 1005,
    })) as MemoryLogJson;

    expect(parsed.pagination.hasMore).toBe(false);
    expect(parsed.pagination.nextOffset).toBeNull();
    expect(parsed.guidance).toEqual({ action: 'previous', offset: 995 });
  });

  it('explains an exhausted table page instead of calling the memory missing', () => {
    expect(formatMemoryLogEmptyPage('mem-123', 10, 5, 3)).toBe(
      '\nNo audit log entries found for memory mem-123 at offset 10, limit 5.\n' +
      'The memory has 3 recorded entries.\n' +
      'Try --offset 0 to view an available page.',
    );
  });

  it('keeps exhausted page-mode navigation in page syntax', () => {
    expect(formatMemoryLogEmptyPage('mem-123', 10, 5, 3, true)).toBe(
      '\nNo audit log entries found for memory mem-123 at offset 10, limit 5.\n' +
      'The memory has 3 recorded entries.\n' +
      'Try --page 1 to view an available page.',
    );
  });

  it('explains the normalized action filter on an exhausted page', () => {
    expect(formatMemoryLogEmptyPage('mem-123', 10, 5, 3, false, ['rolled_back'])).toBe(
      '\nNo audit log entries found for memory mem-123 at offset 10, limit 5.\n' +
      'Action filter: rolled_back\n' +
      'The memory has 3 recorded entries.\n' +
      'Try --offset 0 to view an available page.',
    );
  });
});
