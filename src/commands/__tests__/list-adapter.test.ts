import { describe, expect, it } from 'vitest';
import { applyListFilters, parseListAdapter } from '../list.js';
import type { SnapshotIndexEntry } from '../../index-file.js';

const entry = (id: string, adapter: string): SnapshotIndexEntry => ({
  id,
  timestamp: '2026-01-25T09:30:00.000Z',
  platform: adapter,
  adapter,
  filename: `${id}.saf.enc`,
  size: 1,
});

describe('savestate list --adapter', () => {
  it('defaults to undefined', () => {
    expect(parseListAdapter(undefined)).toBeUndefined();
  });

  it('normalizes the adapter filter', () => {
    expect(parseListAdapter('  CHATGPT ')).toBe('chatgpt');
    expect(parseListAdapter('CLAUDE-WEB')).toBe('claude-web');
    expect(parseListAdapter(' Windsurf ')).toBe('windsurf');
  });

  it.each(['', ' ', 'nope', 'claude', '1', 'chat gpt'])('rejects invalid value %s', (value) => {
    expect(() => parseListAdapter(value)).toThrow(
      `Invalid --adapter value "${value}". Expected one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
    );
  });

  it('matches legacy entries with casing or whitespace differences', () => {
    const snapshots = [entry('chat', ' ChatGPT '), entry('claude', 'claude-code')];
    expect(applyListFilters(snapshots, { adapter: 'chatgpt' }).map((s) => s.id)).toEqual(['chat']);
  });
});
