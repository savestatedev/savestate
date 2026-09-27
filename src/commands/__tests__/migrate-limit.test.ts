import { describe, expect, it } from 'vitest';
import { parseMigrateLimit, resolveMigrateSnapshot } from '../migrate.js';

describe('savestate migrate --limit', () => {
  it('defaults to undefined', () => {
    expect(parseMigrateLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseMigrateLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseMigrateLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseMigrateLimit('1000')).toBe(1000);
    expect(() => parseMigrateLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('picks the newest of the N most recent snapshots', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { limit: '2' },
      ),
    ).toEqual('new');
  });

  it('ANDs --adapter with --limit', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'mid-claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { adapter: 'chatgpt', limit: '2' },
      ),
    ).toEqual('new-gpt');
  });

  it('ANDs --since and --until with --limit', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { since: '2026-04-01', until: '2026-06-01', limit: '1' },
      ),
    ).toEqual('mid');
  });

  it('returns undefined when snapshot-id is outside the N most recent matches', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { snapshot: 'old', limit: '2' },
      ),
    ).toBeUndefined();
  });
});
