import { describe, expect, it } from 'vitest';
import { parseMigrateTo } from '../migrate.js';

describe('savestate migrate --to', () => {
  it('defaults to undefined', () => {
    expect(parseMigrateTo(undefined)).toBeUndefined();
  });

  it('accepts known platforms', () => {
    expect(parseMigrateTo('chatgpt')).toBe('chatgpt');
    expect(parseMigrateTo('claude')).toBe('claude');
    expect(parseMigrateTo('GEMINI')).toBe('gemini');
    expect(parseMigrateTo(' Copilot ')).toBe('copilot');
  });

  it.each(['', ' ', 'nope', 'clawdbot', '1', 'chat gpt'])('rejects invalid value %s', (value) => {
    expect(() => parseMigrateTo(value)).toThrow(
      `Invalid --to value "${value}". Expected one of: chatgpt, claude, gemini, copilot.`,
    );
  });
});
