import { describe, expect, it } from 'vitest';
import { formatCloudListRange } from '../cloud.js';

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
