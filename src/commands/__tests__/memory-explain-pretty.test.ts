import { describe, expect, it } from 'vitest';
import { formatMemoryExplainFreshness } from '../memory.js';

describe('savestate memory explain pretty freshness', () => {
  it('returns the current freshness state for human-facing output', () => {
    const entry = {
      id: 'mem-123',
      content: 'A preference worth remembering.',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      freshnessClass: 'fast' as const,
    };

    expect(formatMemoryExplainFreshness(entry, new Date('2026-10-18T00:00:00.000Z'))).toBe(
      'needs confirmation (fast; verified 2026-10-01)',
    );
  });
});
