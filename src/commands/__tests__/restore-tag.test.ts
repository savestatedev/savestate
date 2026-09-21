import { describe, expect, it } from 'vitest';
import { parseRestoreTag, resolveRestoreSnapshot } from '../restore.js';

describe('savestate restore --tag', () => {
  it('defaults to undefined', () => {
    expect(parseRestoreTag(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot tag', () => {
    expect(parseRestoreTag('work')).toBe('work');
    expect(parseRestoreTag('weekly')).toBe('weekly');
    expect(parseRestoreTag(' v2 ')).toBe('v2');
  });

  it.each(['', ' ', ',', 'work,personal'])('rejects invalid value %s', (value) => {
    expect(() => parseRestoreTag(value)).toThrow(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  });

  it('picks the newest snapshot that includes the tag', () => {
    expect(
      resolveRestoreSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', tags: ['work'] },
          { id: 'personal', timestamp: '2026-09-01T00:00:00Z', tags: ['personal'] },
        ],
        { tag: 'work' },
      ),
    ).toEqual('new');
  });

  it('ANDs snapshot-id with --tag', () => {
    expect(
      resolveRestoreSnapshot(
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
      resolveRestoreSnapshot(
        [
          { id: 'gpt-work', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'gpt-personal', timestamp: '2026-08-01T00:00:00Z', tags: ['personal'] },
        ],
        { snapshot: 'gpt-personal', tag: 'work' },
      ),
    ).toBeUndefined();
  });
});
