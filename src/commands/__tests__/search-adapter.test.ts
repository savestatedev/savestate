import { describe, expect, it } from 'vitest';
import {
  matchesSearchAdapter,
  parseSearchAdapter,
  resolveSearchSnapshots,
} from '../search.js';

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

  it('matches legacy adapter metadata without regard to case or padding', () => {
    expect(
      resolveSearchSnapshots(
        [{ id: 'legacy', timestamp: '2026-01-01T00:00:00Z', adapter: ' ChatGPT ' }],
        { adapter: 'chatgpt' },
      ),
    ).toEqual(['legacy']);
  });

  it('matches explicit snapshot adapter checks like catalog filters', () => {
    expect(matchesSearchAdapter(' ChatGPT ', 'chatgpt')).toBe(true);
    expect(matchesSearchAdapter(' ChatGPT ', ' CHATGPT ')).toBe(true);
    expect(matchesSearchAdapter('claude-code', 'chatgpt')).toBe(false);
  });

  it.each(['', ' ', 'nope', 'claude', '1', 'chat gpt'])('rejects invalid value %s', (value) => {
    expect(() => parseSearchAdapter(value)).toThrow(
      `Invalid --adapter value "${value}". Expected one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
    );
  });
});
