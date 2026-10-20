import { describe, expect, it } from 'vitest';
import { formatTracePaginationHint } from '../trace.js';

describe('trace pagination hints', () => {
  it('describes next and previous pages', () => {
    expect(formatTracePaginationHint('trace runs', 2, 5, 2, 2)).toBe(
      'Showing 2 of 5 trace runs (offset 2, limit 2); next offset 4; previous offset 0.',
    );
  });

  it('suggests the nearest valid page for a stale offset', () => {
    expect(formatTracePaginationHint('trace events', 0, 5, 9, 2)).toBe(
      'Showing 0 of 5 trace events (offset 9, limit 2); previous offset 7; try offset 4.',
    );
  });

  it('stays quiet when the complete collection is shown', () => {
    expect(formatTracePaginationHint('trace runs', 2, 2)).toBe('');
  });
});
