import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import { applyListFilters, parseListTag } from '../list.js';

function entry(tags: string[]): SnapshotIndexEntry {
  return {
    id: 'legacy',
    timestamp: '2026-01-01T00:00:00Z',
    platform: 'chatgpt',
    adapter: 'chatgpt',
    filename: 'legacy.saf.enc',
    size: 1,
    tags,
  };
}

describe('savestate list --tag', () => {
  it('defaults to undefined', () => {
    expect(parseListTag(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot tag', () => {
    expect(parseListTag('work')).toBe('work');
    expect(parseListTag('weekly')).toBe('weekly');
    expect(parseListTag(' v2 ')).toBe('v2');
  });

  it.each(['', ' ', ',', 'work,personal'])('rejects invalid value %s', (value) => {
    expect(() => parseListTag(value)).toThrow(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  });

  it('matches tags from legacy indexes with surrounding whitespace', () => {
    expect(applyListFilters([entry([' weekly '])], { tag: 'weekly' })).toHaveLength(1);
  });
});
