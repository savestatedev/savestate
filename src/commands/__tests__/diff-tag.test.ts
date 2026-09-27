import { describe, expect, it } from 'vitest';
import { parseDiffTag, resolveDiffSnapshot } from '../diff.js';

describe('savestate diff --tag', () => {
  it('defaults to undefined', () => {
    expect(parseDiffTag(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot tag', () => {
    expect(parseDiffTag('work')).toBe('work');
    expect(parseDiffTag('weekly')).toBe('weekly');
    expect(parseDiffTag(' v2 ')).toBe('v2');
  });

  it.each(['', ' ', ',', 'work,personal'])('rejects invalid value %s', (value) => {
    expect(() => parseDiffTag(value)).toThrow(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  });

  it('picks the newest snapshot that includes the tag', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', tags: ['work'] },
          { id: 'personal', timestamp: '2026-09-01T00:00:00Z', tags: ['personal'] },
        ],
        { snapshot: 'latest', tag: 'work' },
      ),
    ).toEqual('new');
  });

  it('ANDs --adapter with --tag', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt', tags: ['work'] },
          { id: 'mid-claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code', tags: ['work'] },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt', tags: ['personal'] },
        ],
        { snapshot: 'latest', adapter: 'chatgpt', tag: 'work' },
      ),
    ).toEqual('old-gpt');
  });

  it('ANDs --until with --tag', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z', tags: ['work'] },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', tags: ['work'] },
        ],
        { snapshot: 'latest', tag: 'work', until: '2026-06-01' },
      ),
    ).toEqual('mid');
  });

  it('ANDs snapshot-id with --tag', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'gpt-work', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'claude-work', timestamp: '2026-05-01T00:00:00Z', tags: ['work'] },
          { id: 'gpt-personal', timestamp: '2026-08-01T00:00:00Z', tags: ['personal'] },
        ],
        { snapshot: 'claude-work', tag: 'work' },
      ),
    ).toEqual('claude-work');
  });

  it('returns undefined when snapshot-id and --tag do not match', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'gpt-work', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'gpt-personal', timestamp: '2026-08-01T00:00:00Z', tags: ['personal'] },
        ],
        { snapshot: 'gpt-personal', tag: 'work' },
      ),
    ).toBeUndefined();
  });
});
