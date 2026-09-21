import { describe, expect, it } from 'vitest';
import type { SnapshotIndexEntry } from '../../index-file.js';
import { parsePruneAdapter, planPrune } from '../prune.js';

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

describe('savestate prune --adapter', () => {
  it('defaults to undefined', () => {
    expect(parsePruneAdapter(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parsePruneAdapter('chatgpt')).toBe('chatgpt');
    expect(parsePruneAdapter('claude-code')).toBe('claude-code');
    expect(parsePruneAdapter('CLAUDE-WEB')).toBe('claude-web');
    expect(parsePruneAdapter(' Windsurf ')).toBe('windsurf');
  });

  it.each(['', ' ', 'nope', 'claude', '1', 'chat gpt'])('rejects invalid value %s', (value) => {
    expect(() => parsePruneAdapter(value)).toThrow(
      `Invalid --adapter value "${value}". Expected one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
    );
  });

  it('only drops snapshots from the selected adapter', () => {
    const plan = planPrune(
      [
        entry({ id: 'old-gpt', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'new-gpt', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        entry({ id: 'old-claude', adapter: 'claude-code', timestamp: '2026-01-01T00:00:00Z' }),
      ],
      { keepLast: 1, adapter: 'chatgpt' },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['old-gpt']);
    expect(plan.keep.map((snapshot) => snapshot.id)).toEqual(['new-gpt', 'old-claude']);
  });

  it('ANDs --adapter with --older-than', () => {
    const plan = planPrune(
      [
        entry({ id: 'old-gpt', adapter: 'chatgpt', timestamp: '2026-01-01T00:00:00Z' }),
        entry({ id: 'new-gpt', adapter: 'chatgpt', timestamp: '2026-05-01T00:00:00Z' }),
        entry({ id: 'old-claude', adapter: 'claude-code', timestamp: '2026-01-01T00:00:00Z' }),
      ],
      { olderThanMs: Date.parse('2026-04-01'), adapter: 'chatgpt' },
    );
    expect(plan.drop.map((snapshot) => snapshot.id)).toEqual(['old-gpt']);
    expect(plan.keep.map((snapshot) => snapshot.id)).toEqual(['new-gpt', 'old-claude']);
  });
});
