import { describe, expect, it } from 'vitest';
import { formatMemoryListEmptyState } from '../memory.js';

describe('savestate memory list human empty state', () => {
  it('explains when no memories match the filters', () => {
    expect(formatMemoryListEmptyState(0, 0)).toBe(
      'No memories found matching the criteria. Try adjusting the filters.',
    );
  });

  it('explains when an offset skips past matching memories', () => {
    expect(formatMemoryListEmptyState(1, 1)).toBe(
      'No memories shown: offset 1 is beyond 1 matching memory. Try a smaller --offset.',
    );
    expect(formatMemoryListEmptyState(3, 5)).toBe(
      'No memories shown: offset 5 is beyond 3 matching memories. Try a smaller --offset.',
    );
  });
});
