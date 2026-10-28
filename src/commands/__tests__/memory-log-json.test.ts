import { describe, expect, it } from 'vitest';
import type { ProvenanceEntry } from '../../checkpoint/types.js';
import {
  formatMemoryLogEmptyPage,
  formatMemoryLogJson,
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
  it('prints audit events as JSON without previous content', () => {
    const parsed = JSON.parse(formatMemoryLogJson('mem-123', [created, edited, merged])) as MemoryLogJson & {
      events: Array<MemoryLogJson['events'][number] & { previous_content?: unknown; actor_id?: unknown }>;
    };
    expect(parsed).toEqual({
      memoryId: 'mem-123',
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
      pagination: {
        offset: 0,
        limit: null,
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
      total: 3,
      shown: 0,
      hasMore: false,
      nextOffset: null,
      previousOffset: 5,
      emptyReason: 'page',
      suggestedOffset: 0,
    });
  });

  it('explains an exhausted table page instead of calling the memory missing', () => {
    expect(formatMemoryLogEmptyPage('mem-123', 10, 5, 3)).toBe(
      '\nNo audit log entries found for memory mem-123 at offset 10, limit 5.\n' +
      'The memory has 3 recorded entries.\n' +
      'Try --offset 0 to view an available page.',
    );
  });
});
