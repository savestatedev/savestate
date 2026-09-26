import { describe, expect, it } from 'vitest';
import { parseMigrateTag, resolveMigrateSnapshot } from '../migrate.js';

describe('savestate migrate --tag', () => {
  it('defaults to undefined', () => {
    expect(parseMigrateTag(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot tag', () => {
    expect(parseMigrateTag('work')).toBe('work');
    expect(parseMigrateTag('weekly')).toBe('weekly');
    expect(parseMigrateTag(' v2 ')).toBe('v2');
  });

  it.each(['', ' ', ',', 'work,personal'])('rejects invalid value %s', (value) => {
    expect(() => parseMigrateTag(value)).toThrow(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  });

  it('picks the newest snapshot that includes the tag', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', tags: ['work'] },
          { id: 'personal', timestamp: '2026-09-01T00:00:00Z', tags: ['personal'] },
        ],
        { tag: 'work' },
      ),
    ).toEqual('new');
  });

  it('ANDs --snapshot with --tag', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'gpt-work', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'claude-work', timestamp: '2026-05-01T00:00:00Z', tags: ['work'] },
          { id: 'gpt-personal', timestamp: '2026-08-01T00:00:00Z', tags: ['personal'] },
        ],
        { snapshot: 'claude-work', tag: 'work' },
      ),
    ).toEqual('claude-work');
  });

  it('returns undefined when --snapshot and --tag do not match', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'gpt-work', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'gpt-personal', timestamp: '2026-08-01T00:00:00Z', tags: ['personal'] },
        ],
        { snapshot: 'gpt-personal', tag: 'work' },
      ),
    ).toBeUndefined();
  });
});
