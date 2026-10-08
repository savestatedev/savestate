import { describe, expect, it } from 'vitest';
import { parseCloudOffset, selectCloudPullPage } from '../cloud.js';

describe('savestate cloud pull --offset', () => {
  it('accepts bounded non-negative offsets', () => {
    expect(parseCloudOffset(undefined)).toBeUndefined();
    expect(parseCloudOffset('0')).toBe(0);
    expect(parseCloudOffset('1000')).toBe(1000);
    expect(() => parseCloudOffset('-1')).toThrow(
      'Invalid --offset value "-1". Expected a non-negative integer up to 1000.',
    );
  });

  it('skips snapshots before applying --limit', () => {
    expect(
      selectCloudPullPage(
        [{ id: 'old' }, { id: 'mid' }, { id: 'new' }],
        1,
        1,
      ).map((snapshot) => snapshot.id),
    ).toEqual(['mid']);
  });

  it('returns the remaining snapshots when only --offset is set', () => {
    expect(selectCloudPullPage([{ id: 'old' }, { id: 'mid' }, { id: 'new' }], undefined, 2))
      .toEqual([{ id: 'new' }]);
  });
});
