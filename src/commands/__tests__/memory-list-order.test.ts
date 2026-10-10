import { describe, expect, it } from 'vitest';
import type { MemoryEntry } from '../../types.js';
import { sortMemoryListEntries } from '../memory.js';

const entry = (id: string, createdAt: string): MemoryEntry => ({
  id,
  content: id,
  source: 'test',
  createdAt,
});

describe('savestate memory list ordering', () => {
  const entries = [
    entry('newer', '2026-01-03T00:00:00.000Z'),
    entry('older', '2026-01-01T00:00:00.000Z'),
    entry('middle', '2026-01-02T00:00:00.000Z'),
  ];

  it('shows newest memories first by default', () => {
    expect(sortMemoryListEntries(entries).map(({ id }) => id)).toEqual([
      'newer',
      'middle',
      'older',
    ]);
  });

  it('supports oldest-first ordering without mutating input', () => {
    expect(sortMemoryListEntries(entries, true).map(({ id }) => id)).toEqual([
      'older',
      'middle',
      'newer',
    ]);
    expect(entries.map(({ id }) => id)).toEqual(['newer', 'older', 'middle']);
  });
});
