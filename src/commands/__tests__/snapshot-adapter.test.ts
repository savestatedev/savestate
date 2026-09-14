import { describe, expect, it } from 'vitest';
import { parseSnapshotAdapter } from '../snapshot.js';

describe('savestate snapshot --adapter', () => {
  it('defaults to undefined', () => {
    expect(parseSnapshotAdapter(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseSnapshotAdapter('chatgpt')).toBe('chatgpt');
    expect(parseSnapshotAdapter('claude-code')).toBe('claude-code');
    expect(parseSnapshotAdapter('CLAUDE-WEB')).toBe('claude-web');
    expect(parseSnapshotAdapter(' Windsurf ')).toBe('windsurf');
  });

  it.each(['', ' ', 'nope', 'claude', '1', 'chat gpt'])('rejects invalid value %s', (value) => {
    expect(() => parseSnapshotAdapter(value)).toThrow(
      `Invalid --adapter value "${value}". Expected one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
    );
  });
});
