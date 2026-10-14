import { describe, expect, it } from 'vitest';
import { formatMemoryListPageSummary } from '../memory.js';

describe('savestate memory list table pagination summary', () => {
  it('omits the summary when every matching memory is shown', () => {
    expect(formatMemoryListPageSummary(2, 2)).toBe('');
  });

  it('describes bounded pages', () => {
    expect(formatMemoryListPageSummary(7, 3, 3, 3)).toBe(
      '(showing 3 of 7 matching memories; offset 3, limit 3)',
    );
  });

  it('describes an unbounded page that starts after an offset', () => {
    expect(formatMemoryListPageSummary(7, 4, 3)).toBe(
      '(showing 4 of 7 matching memories; offset 3)',
    );
  });
});
