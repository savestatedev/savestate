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
    expect(formatMemorySearchEntry(memory)).toEqual([
      '- memory-1',
      '  Type: fact',
      '  Tags: security',
      '  Importance: 0.9',
      '  Metadata: {"source":"security-review","confidence":0.98}',
      '  Created: 2026-10-01T00:00:00.000Z',
      '  Updated: 2026-10-02T00:00:00.000Z',
      '  Expires: none',
      '  Content: The archive is encrypted.',
      '',
    ]);
  });

  it('normalizes padded source identifiers without dropping other metadata', () => {
    const memory: MemoryEntry = {
      id: 'memory-2',
      type: 'fact',
      content: 'The source is legacy padded.',
      metadata: { source: '  Claude-Code  ', confidence: 0.7 },
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };

    expect(formatMemorySearchEntry(memory).join('\n')).toContain(
      '  Metadata: {"source":"Claude-Code","confidence":0.7}',
    );
  });
});
