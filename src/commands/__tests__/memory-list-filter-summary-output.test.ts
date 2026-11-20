import { describe, expect, it } from 'vitest';
import { formatMemoryListFilterSummary } from '../memory.js';

describe('savestate memory list filter summary output', () => {
  it('describes active filters in stable CLI order', () => {
    expect(formatMemoryListFilterSummary({
      tier: 'L1',
      pinned: true,
      source: 'claude-code',
      namespace: ' org:app:agent ',
      unassignedNamespace: false,
      content: 'editor',
      tags: ['work', 'urgent'],
      since: '2026-01-01',
      until: '2026-01-31',
      freshness: 'stale',
      minImportance: 0.8,
      maxImportance: 1,
    })).toBe(
      'tier=L1, pinned, source=claude-code, namespace=org:app:agent, content="editor", tags=[work, urgent], since=2026-01-01, until=2026-01-31, freshness=stale, min-importance=0.8, max-importance=1',
    );
  });

  it('returns no label when no filters are active', () => {
    expect(formatMemoryListFilterSummary({})).toBeUndefined();
  });
});
