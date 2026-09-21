import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import { applyListFilters, parseListExclude } from '../list.js';

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

describe('savestate list --exclude', () => {
  it('defaults to undefined', () => {
    expect(parseListExclude(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseListExclude('chatgpt')).toEqual(['chatgpt']);
    expect(parseListExclude('claude-code, gemini')).toEqual(['claude-code', 'gemini']);
    expect(parseListExclude('CHATGPT')).toEqual(['chatgpt']);
    expect(parseListExclude(' Windsurf ')).toEqual(['windsurf']);
  });

  it.each(['', ' ', 'nope', 'claude', 'chatgpt,bogus', ',,'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseListExclude(value)).toThrow(
        `Invalid --exclude value "${value}". Expected one or more of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
      );
    },
  );

  it('skips snapshots from excluded adapters', () => {
    expect(
      applyListFilters(
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
      applyListFilters(
        [
          entry({ id: 'gpt', adapter: 'chatgpt' }),
          entry({ id: 'claude', adapter: 'claude-code' }),
          entry({ id: 'gemini', adapter: 'gemini' }),
        ],
        { adapter: 'chatgpt', exclude: 'chatgpt' },
      ).map((snapshot) => snapshot.id),
    ).toEqual([]);
    expect(
      applyListFilters(
        [
          entry({ id: 'gpt', adapter: 'chatgpt' }),
          entry({ id: 'claude', adapter: 'claude-code' }),
        ],
        { adapter: 'claude-code', exclude: 'chatgpt' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['claude']);
  });

  it('ANDs --exclude with --tag', () => {
    expect(
      applyListFilters(
        [
          entry({ id: 'gpt', adapter: 'chatgpt', tags: ['weekly'] }),
          entry({ id: 'claude', adapter: 'claude-code', tags: ['weekly'] }),
          entry({ id: 'gemini', adapter: 'gemini', tags: ['daily'] }),
        ],
        { exclude: 'chatgpt', tag: 'weekly' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['claude']);
  });
});
