import { describe, expect, it } from 'vitest';
import { parseDiffAdapter, resolveDiffSnapshot } from '../diff.js';

describe('savestate diff --adapter', () => {
  it('defaults to undefined', () => {
    expect(parseDiffAdapter(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseDiffAdapter('chatgpt')).toBe('chatgpt');
    expect(parseDiffAdapter('claude-code')).toBe('claude-code');
    expect(parseDiffAdapter('CLAUDE-WEB')).toBe('claude-web');
    expect(parseDiffAdapter(' Windsurf ')).toBe('windsurf');
  });

  it.each(['', ' ', 'nope', 'claude', '1', 'chat gpt'])('rejects invalid value %s', (value) => {
    expect(() => parseDiffAdapter(value)).toThrow(
      `Invalid --adapter value "${value}". Expected one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
    );
  });

  it('picks the newest snapshot from the adapter', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'mid-claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { snapshot: 'latest', adapter: 'chatgpt' },
      ),
    ).toEqual('new-gpt');
  });

  it('keeps an explicit snapshot id from the adapter', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { snapshot: 'old-gpt', adapter: 'chatgpt' },
      ),
    ).toEqual('old-gpt');
  });

  it('returns undefined when snapshot-id is from a different adapter', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'claude', timestamp: '2026-08-01T00:00:00Z', adapter: 'claude-code' },
        ],
        { snapshot: 'claude', adapter: 'chatgpt' },
      ),
    ).toBeUndefined();
  });
});
