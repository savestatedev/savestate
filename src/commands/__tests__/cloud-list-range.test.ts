import { describe, expect, it } from 'vitest';
import { formatCloudListNavigation, formatCloudListRange } from '../cloud.js';

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
});

describe('savestate cloud list navigation hints', () => {
  it('points to both neighboring pages when the page is in the middle', () => {
    expect(formatCloudListNavigation(12, 5, 3, 3)).toEqual([
      'Previous page: use --offset 2 --limit 3.',
      'Next page: use --offset 8 --limit 3.',
    ]);
  });

  it('points to the next page from the first page', () => {
    expect(formatCloudListNavigation(12, 0, 3, 3)).toEqual([
      'Next page: use --offset 3 --limit 3.',
    ]);
  });

  it('offers the nearest page when the requested page is empty', () => {
    expect(formatCloudListNavigation(4, 8, 0, 4)).toEqual([
      'Try --offset 0 --limit 4 to view an available page.',
    ]);
  });

  it('does not add navigation when pagination is not requested or the collection is empty', () => {
    expect(formatCloudListNavigation(2, 0, 2)).toEqual([]);
    expect(formatCloudListNavigation(0, 0, 0, 4)).toEqual([]);
  });
});
