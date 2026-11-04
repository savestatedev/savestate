import { describe, expect, it } from 'vitest';
import { formatCloudListEmptyState, formatCloudListRange } from '../cloud.js';

describe('savestate cloud list human-readable range', () => {
  it('describes a paged result', () => {
    expect(formatCloudListRange(12, 5, 3, 3)).toBe('Showing snapshots 6-8 of 12');
  });

  it('explains an empty page beyond the inventory', () => {
    expect(formatCloudListRange(4, 8, 0, 4)).toBe('No snapshots shown (offset 8 is past 4 snapshot(s))');
  });

  it('keeps the existing summary when pagination is not requested', () => {
    expect(formatCloudListRange(2, 0, 2)).toBe('2 snapshot(s) in cloud');
  });

  it('suggests the nearest page when a stale offset returns no rows', () => {
    expect(formatCloudListEmptyState(5, 10, 2)).toBe(
      'No snapshots shown: offset 10 skips past 5 snapshots. Try --offset 4 to open the nearest available page.',
    );
  });

  it('returns to the first page when no page size was requested', () => {
    expect(formatCloudListEmptyState(1, 3)).toBe(
      'No snapshots shown: offset 3 skips past 1 snapshot. Try --offset 0 to open the nearest available page.',
    );
  });
});
