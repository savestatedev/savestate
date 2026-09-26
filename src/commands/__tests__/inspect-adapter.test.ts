import { describe, expect, it } from 'vitest';
import { parseInspectAdapter, resolveInspectSnapshot } from '../inspect.js';

describe('savestate inspect --adapter', () => {
  it('defaults to undefined', () => {
    expect(parseInspectAdapter(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseInspectAdapter('chatgpt')).toBe('chatgpt');
    expect(parseInspectAdapter('claude-code')).toBe('claude-code');
    expect(parseInspectAdapter('CLAUDE-WEB')).toBe('claude-web');
    expect(parseInspectAdapter(' Windsurf ')).toBe('windsurf');
  });

  it.each(['', ' ', 'nope', 'claude', '1', 'chat gpt'])('rejects invalid value %s', (value) => {
    expect(() => parseInspectAdapter(value)).toThrow(
      `Invalid --adapter value "${value}". Expected one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
    );
  });

  it('picks the newest snapshot from the adapter', () => {
    expect(
      resolveInspectSnapshot(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'mid-claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { snapshot: 'latest', adapter: 'chatgpt' },
      ),
    ).toEqual('new-gpt');
  });

  it('ANDs --tag with --adapter', () => {
    expect(
      resolveInspectSnapshot(
        [
          { id: 'old-work', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt', tags: ['work'] },
          { id: 'mid-work', timestamp: '2026-05-01T00:00:00Z', adapter: 'chatgpt', tags: ['work'] },
          { id: 'new-personal', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt', tags: ['personal'] },
        ],
        { snapshot: 'latest', tag: 'work', adapter: 'chatgpt' },
      ),
    ).toEqual('mid-work');
  });

  it('returns undefined when snapshot-id is from a different adapter', () => {
    expect(
      resolveInspectSnapshot(
        [
          { id: 'gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'claude', timestamp: '2026-08-01T00:00:00Z', adapter: 'claude-code' },
        ],
        { snapshot: 'claude', adapter: 'chatgpt' },
      ),
    ).toBeUndefined();
  });
});
