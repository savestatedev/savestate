import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import { applyStatsFilters, parseStatsExclude } from '../stats.js';

function entry(
  partial: Pick<SnapshotIndexEntry, 'id' | 'adapter'> & Partial<SnapshotIndexEntry>,
): SnapshotIndexEntry {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    platform: partial.adapter,
    filename: `${partial.id}.saf.enc`,
    size: 1,
    ...partial,
  };
}

describe('savestate stats --exclude', () => {
  it('defaults to undefined', () => {
    expect(parseStatsExclude(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseStatsExclude('chatgpt')).toEqual(['chatgpt']);
    expect(parseStatsExclude('claude-code, gemini')).toEqual(['claude-code', 'gemini']);
    expect(parseStatsExclude('CHATGPT')).toEqual(['chatgpt']);
    expect(parseStatsExclude(' Windsurf ')).toEqual(['windsurf']);
  });

  it.each(['', ' ', 'nope', 'claude', 'chatgpt,bogus', ',,'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseStatsExclude(value)).toThrow(
        `Invalid --exclude value "${value}". Expected one or more of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
      );
    },
  );

  it('skips snapshots from excluded adapters', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'gpt', adapter: 'chatgpt' }),
          entry({ id: 'claude', adapter: 'claude-code' }),
        ],
        { exclude: 'chatgpt' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['claude']);
  });

  it('ANDs --adapter with --exclude', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'gpt', adapter: 'chatgpt' }),
          entry({ id: 'claude', adapter: 'claude-code' }),
          entry({ id: 'gemini', adapter: 'gemini' }),
        ],
        { adapter: 'chatgpt', exclude: 'chatgpt' },
      ).map((snapshot) => snapshot.id),
    ).toEqual([]);
    expect(
      applyStatsFilters(
        [
          entry({ id: 'gpt', adapter: 'chatgpt' }),
          entry({ id: 'claude', adapter: 'claude-code' }),
        ],
        { adapter: 'claude-code', exclude: 'chatgpt' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['claude']);
  });

  it('ANDs --since and --until with --exclude', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'old-gpt', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
          entry({ id: 'mid-gpt', adapter: 'chatgpt', timestamp: '2026-04-15T00:00:00Z' }),
          entry({ id: 'mid-claude', adapter: 'claude-code', timestamp: '2026-04-15T00:00:00Z' }),
          entry({ id: 'new-claude', adapter: 'claude-code', timestamp: '2026-08-01T00:00:00Z' }),
        ],
        { exclude: 'chatgpt', since: '2026-04-01', until: '2026-05-01' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['mid-claude']);
  });
});
