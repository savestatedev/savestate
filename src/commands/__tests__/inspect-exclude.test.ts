import { describe, expect, it } from 'vitest';
import { parseInspectExclude, resolveInspectSnapshot } from '../inspect.js';

describe('savestate inspect --exclude', () => {
  it('defaults to undefined', () => {
    expect(parseInspectExclude(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseInspectExclude('chatgpt')).toEqual(['chatgpt']);
    expect(parseInspectExclude('claude-code, gemini')).toEqual(['claude-code', 'gemini']);
    expect(parseInspectExclude('CHATGPT')).toEqual(['chatgpt']);
    expect(parseInspectExclude(' Windsurf ')).toEqual(['windsurf']);
  });

  it.each(['', ' ', 'nope', 'claude', 'chatgpt,bogus', ',,'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseInspectExclude(value)).toThrow(
        `Invalid --exclude value "${value}". Expected one or more of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
      );
    },
  );

  it('picks the newest snapshot that is not from an excluded adapter', () => {
    expect(
      resolveInspectSnapshot(
        [
          { id: 'old-claude', timestamp: '2026-01-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'mid-gpt', timestamp: '2026-05-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { snapshot: 'latest', exclude: 'chatgpt' },
      ),
    ).toEqual('old-claude');
  });

  it('ANDs --tag with --exclude', () => {
    expect(
      resolveInspectSnapshot(
        [
          { id: 'old-work', timestamp: '2026-01-01T00:00:00Z', adapter: 'claude-code', tags: ['work'] },
          { id: 'mid-work', timestamp: '2026-05-01T00:00:00Z', adapter: 'chatgpt', tags: ['work'] },
          { id: 'new-personal', timestamp: '2026-08-01T00:00:00Z', adapter: 'claude-code', tags: ['personal'] },
        ],
        { snapshot: 'latest', tag: 'work', exclude: 'chatgpt' },
      ),
    ).toEqual('old-work');
  });

  it('returns undefined when snapshot-id is from an excluded adapter', () => {
    expect(
      resolveInspectSnapshot(
        [
          { id: 'gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'claude', timestamp: '2026-08-01T00:00:00Z', adapter: 'claude-code' },
        ],
        { snapshot: 'gpt', exclude: 'chatgpt' },
      ),
    ).toBeUndefined();
  });
});
