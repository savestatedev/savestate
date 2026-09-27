import { describe, expect, it } from 'vitest';
import { parseDiffSince, resolveDiffSnapshot } from '../diff.js';

describe('savestate diff --since', () => {
  it('defaults to undefined', () => {
    expect(parseDiffSince(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseDiffSince('2026-04-01')).toBe(new Date('2026-04-01').getTime());
    expect(parseDiffSince('2026-04-01T00:00:00Z')).toBe(
      new Date('2026-04-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseDiffSince(value)).toThrow(
        `Invalid --since value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );

  it('picks the newest snapshot taken after the cutoff', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { snapshot: 'latest', since: '2026-04-01' },
      ),
    ).toEqual('new');
  });

  it('ANDs --adapter with --since', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'mid-claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { snapshot: 'latest', adapter: 'chatgpt', since: '2026-04-01' },
      ),
    ).toEqual('new-gpt');
  });

  it('ANDs --since with --until', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { snapshot: 'latest', since: '2026-04-01', until: '2026-06-01' },
      ),
    ).toEqual('mid');
  });

  it('returns undefined when snapshot-id is before --since', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { snapshot: 'old', since: '2026-04-01' },
      ),
    ).toBeUndefined();
  });
});
