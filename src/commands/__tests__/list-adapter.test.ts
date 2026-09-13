import { describe, expect, it } from 'vitest';
import { parseListAdapter } from '../list.js';

describe('savestate list --adapter', () => {
  it('defaults to undefined', () => {
    expect(parseListAdapter(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseListAdapter('chatgpt')).toBe('chatgpt');
    expect(parseListAdapter('claude-code')).toBe('claude-code');
    expect(parseListAdapter('CLAUDE-WEB')).toBe('claude-web');
    expect(parseListAdapter(' Windsurf ')).toBe('windsurf');
  });

  it.each(['', ' ', 'nope', 'claude', '1', 'chat gpt'])('rejects invalid value %s', (value) => {
    expect(() => parseListAdapter(value)).toThrow(
      `Invalid --adapter value "${value}". Expected one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
    );
  });
});
