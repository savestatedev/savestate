import { describe, expect, it } from 'vitest';
import { parseDiffUntil, resolveDiffSnapshot } from '../diff.js';

describe('savestate diff --until', () => {
  it('defaults to undefined', () => {
    expect(parseDiffUntil(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseDiffUntil('2026-06-01')).toBe(new Date('2026-06-01').getTime());
    expect(parseDiffUntil('2026-06-01T00:00:00Z')).toBe(
      new Date('2026-06-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseDiffUntil(value)).toThrow(
        `Invalid --until value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );

  it('picks the newest snapshot taken on or before the cutoff', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { snapshot: 'latest', until: '2026-06-01' },
      ),
    ).toEqual('mid');
  });

  it('ANDs --adapter with --until', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'mid-claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { snapshot: 'latest', adapter: 'chatgpt', until: '2026-06-01' },
      ),
    ).toEqual('old-gpt');
  });

  it('returns undefined when snapshot-id is after --until', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { snapshot: 'new', until: '2026-04-01' },
      ),
    ).toBeUndefined();
  });
});
