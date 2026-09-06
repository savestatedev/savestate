import { describe, expect, it } from 'vitest';
import type { MemoryEntry } from '../../types.js';
import {
  formatMemoryListJson,
  type MemoryListJson,
} from '../memory.js';

function entry(partial: Partial<MemoryEntry> & Pick<MemoryEntry, 'id' | 'content'>): MemoryEntry {
  return {
    source: partial.source ?? 'user',
    createdAt: partial.createdAt ?? '2026-09-01T00:00:00.000Z',
    ...partial,
  };
}

describe('savestate memory --json', () => {
  it('prints list summary and entries as JSON', () => {
    const all = [
      entry({ id: 'mem-l1', content: 'inbox preference', tier: 'L1', pinned: true }),
      entry({ id: 'mem-l2', content: 'working note', tier: 'L2', source: 'agent' }),
      entry({ id: 'mem-l3', content: 'archive fact', createdAt: '2026-08-01T00:00:00.000Z' }),
    ];
    const parsed = JSON.parse(formatMemoryListJson(all, [all[0], all[1]])) as MemoryListJson;
    expect(parsed.total).toBe(3);
    expect(parsed.shown).toBe(2);
    expect(parsed.byTier).toEqual({ L1: 1, L2: 1, L3: 1 });
    expect(parsed.pinned).toBe(1);
    expect(parsed.entries).toEqual([
      {
        id: 'mem-l1',
        tier: 'L1',
        pinned: true,
        source: 'user',
        createdAt: '2026-09-01T00:00:00.000Z',
        content: 'inbox preference',
      },
      {
        id: 'mem-l2',
        tier: 'L2',
        pinned: false,
        source: 'agent',
        createdAt: '2026-09-01T00:00:00.000Z',
        content: 'working note',
      },
    ]);
  });

  it('records empty lists with zero counts', () => {
    const parsed = JSON.parse(formatMemoryListJson([], [])) as MemoryListJson;
    expect(parsed.total).toBe(0);
    expect(parsed.shown).toBe(0);
    expect(parsed.byTier).toEqual({ L1: 0, L2: 0, L3: 0 });
    expect(parsed.pinned).toBe(0);
    expect(parsed.entries).toEqual([]);
  });
});
