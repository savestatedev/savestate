import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import { applyStatsFilters, parseStatsAdapter } from '../stats.js';

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

describe('savestate stats --adapter', () => {
  it('defaults to undefined', () => {
    expect(parseStatsAdapter(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseStatsAdapter('chatgpt')).toBe('chatgpt');
    expect(parseStatsAdapter('claude-code')).toBe('claude-code');
    expect(parseStatsAdapter('CLAUDE-WEB')).toBe('claude-web');
    expect(parseStatsAdapter(' Windsurf ')).toBe('windsurf');
  });

  it.each(['', ' ', 'nope', 'claude', '1', 'chat gpt'])('rejects invalid value %s', (value) => {
    expect(() => parseStatsAdapter(value)).toThrow(
      `Invalid --adapter value "${value}". Expected one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
    );
  });

  it('keeps snapshots from the selected adapter', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'gpt', adapter: 'chatgpt' }),
          entry({ id: 'claude', adapter: 'claude-code' }),
        ],
        { adapter: 'chatgpt' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['gpt']);
  });

  it('ANDs --adapter with --since', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'old-gpt', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
          entry({ id: 'new-gpt', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
          entry({ id: 'new-claude', adapter: 'claude-code', timestamp: '2026-05-01T00:00:00Z' }),
        ],
        { adapter: 'chatgpt', since: '2026-04-01' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['new-gpt']);
  });
});
