import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import { parsePruneExclude, planPrune } from '../prune.js';

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

describe('savestate prune --exclude', () => {
  it('defaults to undefined', () => {
    expect(parsePruneExclude(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parsePruneExclude('chatgpt')).toEqual(['chatgpt']);
    expect(parsePruneExclude('claude-code, gemini')).toEqual(['claude-code', 'gemini']);
    expect(parsePruneExclude('CHATGPT')).toEqual(['chatgpt']);
    expect(parsePruneExclude(' Windsurf ')).toEqual(['windsurf']);
  });

  it.each(['', ' ', 'nope', 'claude', 'chatgpt,bogus', ',,'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parsePruneExclude(value)).toThrow(
        `Invalid --exclude value "${value}". Expected one or more of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
      );
    },
  );

  it('skips snapshots from excluded adapters', () => {
    const plan = planPrune(
      [
        entry({ id: 'old-gpt', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'new-gpt', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        entry({ id: 'old-claude', adapter: 'claude-code', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'new-claude', adapter: 'claude-code', timestamp: '2026-05-01T00:00:00Z' }),
      ],
      { keepLast: 1, exclude: ['chatgpt'] },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['old-claude']);
    expect(plan.keep.map((snapshot) => snapshot.id)).toEqual([
      'new-claude',
      'old-gpt',
      'new-gpt',
    ]);
  });

  it('ANDs --adapter with --exclude', () => {
    const empty = planPrune(
      [
        entry({ id: 'old-gpt', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'new-gpt', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        entry({ id: 'old-claude', adapter: 'claude-code', timestamp: '2026-01-01T00:00:00Z' }),
      ],
      { keepLast: 1, adapter: 'chatgpt', exclude: ['chatgpt'] },
    );
    expect(empty.drop.map((snapshot) => snapshot.id)).toEqual([]);
    expect(empty.keep.map((snapshot) => snapshot.id).sort()).toEqual([
      'new-gpt',
      'old-claude',
      'old-gpt',
    ]);

    const plan = planPrune(
      [
        entry({ id: 'old-gpt', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'old-claude', adapter: 'claude-code', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'new-claude', adapter: 'claude-code', timestamp: '2026-05-01T00:00:00Z' }),
      ],
      { keepLast: 1, adapter: 'claude-code', exclude: ['chatgpt'] },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['old-claude']);
    expect(plan.keep.map((snapshot) => snapshot.id)).toEqual(['new-claude', 'old-gpt']);
  });

  it('ANDs --exclude with --older-than', () => {
    const plan = planPrune(
      [
        entry({ id: 'old-gpt', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'old-claude', adapter: 'claude-code', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'new-claude', adapter: 'claude-code', timestamp: '2026-05-01T00:00:00Z' }),
      ],
      { olderThanMs: Date.parse('2026-04-01'), exclude: ['chatgpt'] },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['old-claude']);
    expect(plan.keep.map((snapshot) => snapshot.id)).toEqual(['new-claude', 'old-gpt']);
  });
});
