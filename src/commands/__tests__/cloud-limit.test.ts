import { describe, expect, it } from 'vitest';
import { parseCloudLimit, resolveCloudPushSnapshots } from '../cloud.js';

describe('savestate cloud --limit', () => {
  it('defaults to undefined', () => {
    expect(parseCloudLimit(undefined)).toBeUndefined();
  });

  it('accepts positive integers', () => {
    expect(parseCloudLimit('12')).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'nope'])('rejects invalid value %s', (value) => {
    expect(() => parseCloudLimit(value)).toThrow(
      `Invalid --limit value "${value}". Expected a positive integer up to 1000.`,
    );
  });

  it('rejects values above the bounded result count', () => {
    expect(parseCloudLimit('1000')).toBe(1000);
    expect(() => parseCloudLimit('1001')).toThrow(
      'Invalid --limit value "1001". Expected a positive integer up to 1000.',
    );
  });

  it('picks the newest matching snapshots', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { limit: '2' },
      ).map((entry) => entry.id),
    ).toEqual(['new', 'mid']);
  });

  it('ANDs --id with --limit', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old-work', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'new-work', timestamp: '2026-08-01T00:00:00Z' },
          { id: 'personal', timestamp: '2026-09-01T00:00:00Z' },
        ],
        { id: 'old-work', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['old-work']);
  });

  it('ANDs --adapter with --limit', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { adapter: 'chatgpt', limit: '2' },
      ).map((entry) => entry.id),
    ).toEqual(['new-gpt', 'old-gpt']);
  });

  it('ANDs --since with --limit', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { since: '2026-04-01', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['new']);
  });

  it('ANDs --tag with --limit', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', tags: ['work'] },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z', tags: ['personal'] },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', tags: ['work'] },
        ],
        { tag: 'work', limit: '2' },
      ).map((entry) => entry.id),
    ).toEqual(['new', 'old']);
  });

  it('caps --all to the newest matching snapshots', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z' },
        ],
        { all: true, limit: '2' },
      ).map((entry) => entry.id),
    ).toEqual(['new', 'mid']);
  });
});
