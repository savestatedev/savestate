import { describe, expect, it } from 'vitest';
import { parseSearchTag, resolveSearchSnapshots } from '../search.js';

describe('savestate search --tag', () => {
  it('defaults to undefined', () => {
    expect(parseSearchTag(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot tag', () => {
    expect(parseSearchTag('work')).toBe('work');
    expect(parseSearchTag('weekly')).toBe('weekly');
    expect(parseSearchTag(' v2 ')).toBe('v2');
  });

  it.each(['', ' ', ',', 'work,personal'])('rejects invalid value %s', (value) => {
    expect(() => parseSearchTag(value)).toThrow(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  });

  it('keeps snapshots that include the tag', () => {
    expect(
      resolveSearchSnapshots(
        [
          { id: 'work', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'personal', timestamp: '2026-05-01T00:00:00Z', tags: ['personal'] },
        ],
        { tag: 'work' },
      ),
    ).toEqual(['work']);
  });

  it('ANDs --snapshot with --tag', () => {
    expect(
      resolveSearchSnapshots(
        [
          { id: 'work', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'personal', timestamp: '2026-05-01T00:00:00Z', tags: ['personal'] },
        ],
        { snapshot: 'personal', tag: 'work' },
      ),
    ).toEqual([]);
    expect(
      resolveSearchSnapshots(
        [
          { id: 'work', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'personal', timestamp: '2026-05-01T00:00:00Z', tags: ['personal'] },
        ],
        { snapshot: 'work', tag: 'work' },
      ),
    ).toEqual(['work']);
  });
});
