import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import { applyStatsFilters, parseStatsPlatform } from '../stats.js';

function entry(partial: Partial<SnapshotIndexEntry>): SnapshotIndexEntry {
  return {
    id: partial.id ?? 'ss-x',
    timestamp: partial.timestamp ?? '2026-01-01T00:00:00Z',
    platform: partial.platform ?? 'claude',
    adapter: partial.adapter ?? 'claude-code',
    filename: partial.filename ?? 'ss-x.saf.enc',
    size: partial.size ?? 1024,
    label: partial.label,
    tags: partial.tags,
  };
}

describe('savestate stats --platform', () => {
  it('normalizes a platform id', () => {
    expect(parseStatsPlatform(' Claude ')).toBe('claude');
    expect(parseStatsPlatform(undefined)).toBeUndefined();
  });

  it.each(['', ' ', 'claude web', 'claude,openai'])('rejects invalid value %s', (value) => {
    expect(() => parseStatsPlatform(value)).toThrow(
      `Invalid --platform value "${value}". Expected a single non-empty platform id (no spaces or commas).`,
    );
  });

  it('matches legacy platform casing and whitespace', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'legacy', platform: ' Claude ' }),
          entry({ id: 'openai', platform: 'openai' }),
        ],
        { platform: 'claude' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['legacy']);
  });
});
