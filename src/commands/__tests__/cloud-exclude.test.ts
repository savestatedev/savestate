import { describe, expect, it } from 'vitest';
import { parseCloudExclude, resolveCloudPushSnapshots } from '../cloud.js';

describe('savestate cloud --exclude', () => {
  it('defaults to undefined', () => {
    expect(parseCloudExclude(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseCloudExclude('chatgpt')).toEqual(['chatgpt']);
    expect(parseCloudExclude('claude-code, gemini')).toEqual(['claude-code', 'gemini']);
    expect(parseCloudExclude('CHATGPT')).toEqual(['chatgpt']);
    expect(parseCloudExclude(' Windsurf ')).toEqual(['windsurf']);
  });

  it.each(['', ' ', 'nope', 'claude', 'chatgpt,bogus', ',,'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseCloudExclude(value)).toThrow(
        `Invalid --exclude value "${value}". Expected one or more of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
      );
    },
  );

  it('picks the newest snapshot that is not from an excluded adapter', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old-claude', timestamp: '2026-01-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'mid-gpt', timestamp: '2026-05-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { exclude: 'chatgpt' },
      ).map((entry) => entry.id),
    ).toEqual(['old-claude']);
  });

  it('ANDs --id with --exclude', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old-claude', timestamp: '2026-01-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { id: 'old-claude', exclude: 'chatgpt' },
      ).map((entry) => entry.id),
    ).toEqual(['old-claude']);
  });

  it('returns empty when snapshot-id is from an excluded adapter', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'claude', timestamp: '2026-08-01T00:00:00Z', adapter: 'claude-code' },
        ],
        { id: 'gpt', exclude: 'chatgpt' },
      ),
    ).toEqual([]);
  });

  it('returns every matching snapshot with --all', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old-claude', timestamp: '2026-01-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'mid-gpt', timestamp: '2026-05-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'new-claude', timestamp: '2026-08-01T00:00:00Z', adapter: 'claude-code' },
        ],
        { exclude: 'chatgpt', all: true },
      ).map((entry) => entry.id),
    ).toEqual(['old-claude', 'new-claude']);
  });
});
