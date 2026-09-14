import { describe, expect, it } from 'vitest';
import { parseRestoreTo } from '../restore.js';

describe('savestate restore --to', () => {
  it('defaults to undefined', () => {
    expect(parseRestoreTo(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseRestoreTo('chatgpt')).toBe('chatgpt');
    expect(parseRestoreTo('claude-code')).toBe('claude-code');
    expect(parseRestoreTo('CLAUDE-WEB')).toBe('claude-web');
    expect(parseRestoreTo(' Windsurf ')).toBe('windsurf');
  });

  it.each(['', ' ', 'nope', 'claude', '1', 'chat gpt'])('rejects invalid value %s', (value) => {
    expect(() => parseRestoreTo(value)).toThrow(
      `Invalid --to value "${value}". Expected one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
    );
  });
});
