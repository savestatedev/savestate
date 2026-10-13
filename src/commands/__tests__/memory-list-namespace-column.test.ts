import { describe, expect, it } from 'vitest';
import type { MemoryEntry } from '../../types.js';
import { shouldShowMemoryListNamespace } from '../memory.js';

const entry = (metadata?: MemoryEntry['metadata']) => ({
  id: 'memory-1',
  content: 'content',
  source: 'test',
  createdAt: '2026-01-01T00:00:00.000Z',
  metadata,
}) as MemoryEntry;

describe('memory list namespace column', () => {
  it('keeps the namespace column when a later page has the namespace-free entry', () => {
    expect(shouldShowMemoryListNamespace([
      entry({ namespace: 'org:app:agent' }),
      entry(),
    ])).toBe(true);
  });

  it('omits the namespace column when no result has namespace metadata', () => {
    expect(shouldShowMemoryListNamespace([entry(), entry({ source: 'import' })])).toBe(false);
  });
});
