import { describe, expect, it } from 'vitest';
import { parseSearchAdapter } from '../search.js';

describe('savestate search --adapter', () => {
  it('defaults to undefined', () => {
    expect(parseSearchAdapter(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseSearchAdapter('chatgpt')).toBe('chatgpt');
    expect(parseSearchAdapter('claude-code')).toBe('claude-code');
    expect(parseSearchAdapter('CLAUDE-WEB')).toBe('claude-web');
    expect(parseSearchAdapter(' Windsurf ')).toBe('windsurf');
  });

  it.each(['', ' ', 'nope', 'claude', '1', 'chat gpt'])('rejects invalid value %s', (value) => {
    expect(() => parseSearchAdapter(value)).toThrow(
      `Invalid --adapter value "${value}". Expected one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
    );
  });
});
