import { describe, expect, it } from 'vitest';
import { parseInspectTag, resolveInspectSnapshot } from '../inspect.js';

describe('savestate inspect --tag', () => {
  it('defaults to undefined', () => {
    expect(parseInspectTag(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot tag', () => {
    expect(parseInspectTag('work')).toBe('work');
    expect(parseInspectTag('weekly')).toBe('weekly');
    expect(parseInspectTag(' v2 ')).toBe('v2');
  });

  it.each(['', ' ', ',', 'work,personal'])('rejects invalid value %s', (value) => {
    expect(() => parseInspectTag(value)).toThrow(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  });

  it('picks the newest snapshot that includes the tag', () => {
    expect(
      resolveInspectSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', tags: ['work'] },
          { id: 'personal', timestamp: '2026-09-01T00:00:00Z', tags: ['personal'] },
        ],
        { snapshot: 'latest', tag: 'work' },
      ),
    ).toEqual('new');
  });

  it('ANDs snapshot-id with --tag', () => {
    expect(
      resolveInspectSnapshot(
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
      resolveInspectSnapshot(
        [
          { id: 'gpt-work', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'gpt-personal', timestamp: '2026-08-01T00:00:00Z', tags: ['personal'] },
        ],
        { snapshot: 'gpt-personal', tag: 'work' },
      ),
    ).toBeUndefined();
  });
});
