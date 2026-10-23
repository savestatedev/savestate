import { describe, expect, it } from 'vitest';
import type { MemoryEntry } from '../../memory/types.js';
import { formatMemorySearchEntry } from '../memory-search-entry.js';

describe('MCP memory search entries', () => {
  it('includes metadata promised by the search tool', () => {
    const memory: MemoryEntry = {
      id: 'memory-1',
      type: 'fact',
      content: 'The archive is encrypted.',
      metadata: { source: 'security-review', confidence: 0.98 },
      tags: ['security'],
      importance: 0.9,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
    };

    expect(formatMemorySearchEntry(memory)).toContain(
      '  Metadata: {"source":"security-review","confidence":0.98}',
    );
  });
});
