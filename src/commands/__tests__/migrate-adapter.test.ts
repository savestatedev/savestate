import { describe, expect, it } from 'vitest';
import { parseMigrateAdapter, resolveMigrateSnapshot } from '../migrate.js';

describe('savestate migrate --adapter', () => {
  it('defaults to undefined', () => {
    expect(parseMigrateAdapter(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseMigrateAdapter('chatgpt')).toBe('chatgpt');
    expect(parseMigrateAdapter('claude-code')).toBe('claude-code');
    expect(parseMigrateAdapter('CLAUDE-WEB')).toBe('claude-web');
    expect(parseMigrateAdapter(' Windsurf ')).toBe('windsurf');
  });

  it.each(['', ' ', 'nope', 'claude', '1', 'chat gpt'])('rejects invalid value %s', (value) => {
    expect(() => parseMigrateAdapter(value)).toThrow(
      `Invalid --adapter value "${value}". Expected one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
    );
  });

  it('picks the newest snapshot from the adapter', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'mid-claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { adapter: 'chatgpt' },
      ),
    ).toEqual('new-gpt');
  });

  it('ANDs --since with --adapter', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'mid-gpt', timestamp: '2026-05-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'new-claude', timestamp: '2026-08-01T00:00:00Z', adapter: 'claude-code' },
        ],
        { adapter: 'chatgpt', since: '2026-04-01' },
      ),
    ).toEqual('mid-gpt');
  });

  it('returns undefined when snapshot-id is from a different adapter', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'claude', timestamp: '2026-08-01T00:00:00Z', adapter: 'claude-code' },
        ],
        { snapshot: 'claude', adapter: 'chatgpt' },
      ),
    ).toBeUndefined();
  });
});
