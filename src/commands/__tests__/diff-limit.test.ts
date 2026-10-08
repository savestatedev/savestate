import { describe, expect, it } from 'vitest';
import { parseDiffLimit, resolveDiffSnapshot } from '../diff.js';

describe('savestate diff --limit', () => {
  it('defaults to undefined', () => {
    expect(parseDiffLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseDiffLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', ' 2', '2 ', '1e2', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseDiffLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseDiffLimit('1000')).toBe(1000);
    expect(() => parseDiffLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('picks the newest of the N most recent snapshots', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { snapshot: 'latest', limit: '2' },
      ),
    ).toEqual('new');
  });

  it('ANDs --adapter with --limit', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'mid-claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { snapshot: 'latest', adapter: 'chatgpt', limit: '2' },
      ),
    ).toEqual('new-gpt');
  });

  it('ANDs --since and --until with --limit', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { snapshot: 'latest', since: '2026-04-01', until: '2026-06-01', limit: '1' },
      ),
    ).toEqual('mid');
  });

  it('returns undefined when snapshot-id is outside the N most recent matches', () => {
    expect(
      resolveDiffSnapshot(
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
