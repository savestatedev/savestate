import { describe, expect, it } from 'vitest';
import type { MemoryEntry } from '../../memory/types.js';
import { formatMemoryListEntry } from '../memory-list-entry.js';

describe('MCP list_memories entries', () => {
  it('includes metadata and lifecycle timestamps', () => {
    const memory: MemoryEntry = {
      id: 'memory-1',
      type: 'preference',
      content: 'Use concise answers.',
      metadata: { source: 'settings', confidence: 0.9 },
      tags: ['style'],
      importance: 0.7,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
      expiresAt: '2026-11-01T00:00:00.000Z',
    };

    expect(formatMemoryListEntry(memory)).toEqual([
      '- [preference] memory-1',
      '  Use concise answers.',
      '  Tags: style',
      '  Importance: 0.7',
      '  Metadata: {"source":"settings","confidence":0.9}',
      '  Created: 2026-10-01T00:00:00.000Z',
      '  Updated: 2026-10-02T00:00:00.000Z',
      '  Expires: 2026-11-01T00:00:00.000Z',
      '',
    ]);
  });
});
