import { describe, expect, it } from 'vitest';
import { applyListFilters, parseListPlatform } from '../list.js';
import type { SnapshotIndexEntry } from '../../index-file.js';

const entry = (id: string, platform: string): SnapshotIndexEntry => ({
  id,
  timestamp: '2026-01-25T09:30:00.000Z',
  platform,
  adapter: platform,
  filename: `${id}.saf.enc`,
  size: 1,
});

describe('savestate list --platform', () => {
  it('accepts a single platform id and trims surrounding whitespace', () => {
    expect(parseListPlatform('  CHATGPT ')).toBe('chatgpt');
  });

  it('rejects blank, comma-separated, or whitespace-containing values', () => {
    for (const value of ['', 'chatgpt,claude', 'chat gpt']) {
      expect(() => parseListPlatform(value)).toThrow(/Invalid --platform value/);
    }
  });

  it('keeps only snapshots with the matching recorded platform', () => {
    const snapshots = [entry('chat', ' ChatGPT '), entry('claude', 'claude')];
    expect(applyListFilters(snapshots, { platform: 'chatgpt' }).map((s) => s.id)).toEqual(['chat']);
  });
});
