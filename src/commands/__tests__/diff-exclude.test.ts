import { describe, expect, it } from 'vitest';
import { parseDiffExclude, resolveDiffSnapshot } from '../diff.js';

describe('savestate diff --exclude', () => {
  it('defaults to undefined', () => {
    expect(parseDiffExclude(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseDiffExclude('chatgpt')).toEqual(['chatgpt']);
    expect(parseDiffExclude('claude-code, gemini')).toEqual(['claude-code', 'gemini']);
    expect(parseDiffExclude('CHATGPT')).toEqual(['chatgpt']);
    expect(parseDiffExclude(' Windsurf ')).toEqual(['windsurf']);
  });

  it.each(['', ' ', 'nope', 'claude', 'chatgpt,bogus', ',,'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseDiffExclude(value)).toThrow(
        `Invalid --exclude value "${value}". Expected one or more of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
      );
    },
  );

  it('picks the newest snapshot that is not from an excluded adapter', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old-claude', timestamp: '2026-01-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'mid-gpt', timestamp: '2026-05-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { snapshot: 'latest', exclude: 'chatgpt' },
      ),
    ).toEqual('old-claude');
  });

  it('ANDs --until with --exclude', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old-claude', timestamp: '2026-01-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'mid-gpt', timestamp: '2026-05-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'new-claude', timestamp: '2026-08-01T00:00:00Z', adapter: 'claude-code' },
        ],
        { snapshot: 'latest', exclude: 'chatgpt', until: '2026-06-01' },
      ),
    ).toEqual('old-claude');
  });

  it('returns undefined when snapshot-id is from an excluded adapter', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'claude', timestamp: '2026-08-01T00:00:00Z', adapter: 'claude-code' },
        ],
        { snapshot: 'gpt', exclude: 'chatgpt' },
      ),
    ).toBeUndefined();
  });
});
