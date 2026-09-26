import { describe, expect, it } from 'vitest';
import { parseCloudAdapter, resolveCloudPushSnapshots } from '../cloud.js';

describe('savestate cloud --adapter', () => {
  it('defaults to undefined', () => {
    expect(parseCloudAdapter(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseCloudAdapter('chatgpt')).toBe('chatgpt');
    expect(parseCloudAdapter('claude-code')).toBe('claude-code');
    expect(parseCloudAdapter('CLAUDE-WEB')).toBe('claude-web');
    expect(parseCloudAdapter(' Windsurf ')).toBe('windsurf');
  });

  it.each(['', ' ', 'nope', 'claude', '1', 'chat gpt'])('rejects invalid value %s', (value) => {
    expect(() => parseCloudAdapter(value)).toThrow(
      `Invalid --adapter value "${value}". Expected one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
    );
  });

  it('picks the newest snapshot from the adapter', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'mid-claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { adapter: 'chatgpt' },
      ).map((entry) => entry.id),
    ).toEqual(['new-gpt']);
  });

  it('ANDs --id with --adapter', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'claude', timestamp: '2026-08-01T00:00:00Z', adapter: 'claude-code' },
        ],
        { id: 'old-gpt', adapter: 'chatgpt' },
      ).map((entry) => entry.id),
    ).toEqual(['old-gpt']);
  });

  it('returns empty when snapshot-id is from a different adapter', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'claude', timestamp: '2026-08-01T00:00:00Z', adapter: 'claude-code' },
        ],
        { id: 'claude', adapter: 'chatgpt' },
      ),
    ).toEqual([]);
  });

  it('returns every matching snapshot with --all', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'mid-claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { adapter: 'chatgpt', all: true },
      ).map((entry) => entry.id),
    ).toEqual(['old-gpt', 'new-gpt']);
  });
});
