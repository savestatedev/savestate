import { describe, expect, it } from 'vitest';
import { parseCloudTag, resolveCloudPushSnapshots } from '../cloud.js';

describe('savestate cloud --tag', () => {
  it('defaults to undefined', () => {
    expect(parseCloudTag(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot tag', () => {
    expect(parseCloudTag('work')).toBe('work');
    expect(parseCloudTag('weekly')).toBe('weekly');
    expect(parseCloudTag(' v2 ')).toBe('v2');
  });

  it.each(['', ' ', ',', 'work,personal'])('rejects invalid value %s', (value) => {
    expect(() => parseCloudTag(value)).toThrow(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  });

  it('picks the newest snapshot that includes the tag', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', tags: ['work'] },
          { id: 'personal', timestamp: '2026-09-01T00:00:00Z', tags: ['personal'] },
        ],
        { tag: 'work' },
      ).map((entry) => entry.id),
    ).toEqual(['new']);
  });

  it('ANDs --id with --tag', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old-work', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'new-work', timestamp: '2026-08-01T00:00:00Z', tags: ['work'] },
          { id: 'personal', timestamp: '2026-08-01T00:00:00Z', tags: ['personal'] },
        ],
        { id: 'old-work', tag: 'work' },
      ).map((entry) => entry.id),
    ).toEqual(['old-work']);
  });

  it('returns empty when snapshot-id does not include --tag', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'work', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'personal', timestamp: '2026-08-01T00:00:00Z', tags: ['personal'] },
        ],
        { id: 'personal', tag: 'work' },
      ),
    ).toEqual([]);
  });

  it('ANDs --adapter with --tag', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt', tags: ['work'] },
          { id: 'claude-work', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code', tags: ['work'] },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt', tags: ['work'] },
        ],
        { adapter: 'chatgpt', tag: 'work' },
      ).map((entry) => entry.id),
    ).toEqual(['new-gpt']);
  });

  it('ANDs --since with --tag', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z', tags: ['work'] },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', tags: ['personal'] },
        ],
        { since: '2026-04-01', tag: 'work' },
      ).map((entry) => entry.id),
    ).toEqual(['mid']);
  });

  it('returns every matching snapshot with --all', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z', tags: ['personal'] },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', tags: ['work'] },
        ],
        { tag: 'work', all: true },
      ).map((entry) => entry.id),
    ).toEqual(['old', 'new']);
  });
});
