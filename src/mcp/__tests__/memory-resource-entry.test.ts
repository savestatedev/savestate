import { describe, expect, it } from 'vitest';
import type { MemoryEntry } from '../../memory/types.js';
import { toMemoryResourceEntry } from '../memory-resource-entry.js';

describe('MCP memory resource entries', () => {
  it('preserves lifecycle timestamps for clients', () => {
    const memory: MemoryEntry = {
      id: 'memory-1',
      type: 'fact',
      content: 'The archive is encrypted.',
      tags: ['security'],
      importance: 0.9,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
      expiresAt: '2026-11-01T00:00:00.000Z',
    };

    expect(toMemoryResourceEntry(memory)).toEqual({
      id: 'memory-1',
      type: 'fact',
      content: 'The archive is encrypted.',
      tags: ['security'],
      importance: 0.9,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
      expiresAt: '2026-11-01T00:00:00.000Z',
    });
  });
});
