import { describe, expect, it } from 'vitest';
import { formatMemoryListEmptyState } from '../memory.js';

describe('savestate memory list human empty state', () => {
  it('explains when no memories match the filters', () => {
    expect(formatMemoryListEmptyState(0, 0)).toBe(
      'No memories found matching the criteria. Try adjusting the filters.',
    );
  });

  it('explains how to populate an empty snapshot', () => {
    expect(formatMemoryListEmptyState(0, 0, 20, true)).toBe(
      'No memories found in this snapshot. Capture or import memories to populate this list.',
    );

    expect(formatMemoryListEmptyState(0, 0, 20, true, 'ss-empty-2026-10-17')).toBe(
      'No memories found in this snapshot ss-empty-2026-10-17. Capture or import memories to populate this list.',
    );
  });

  it('explains when an offset skips past matching memories', () => {
    expect(formatMemoryListEmptyState(1, 1)).toBe(
      'No memories shown: offset 1 skips past 1 matching memory. Try --offset 0 to open the nearest available page.',
    );
    expect(formatMemoryListEmptyState(45, 100, 20)).toBe(
      'No memories shown: offset 100 skips past 45 matching memories. Try --offset 40 to open the nearest available page.',
    );
  });
});
