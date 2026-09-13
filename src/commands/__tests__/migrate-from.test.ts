import { describe, expect, it } from 'vitest';
import { parseMigrateFrom } from '../migrate.js';

describe('savestate migrate --from', () => {
  it('defaults to undefined', () => {
    expect(parseMigrateFrom(undefined)).toBeUndefined();
  });

  it('accepts known platforms', () => {
    expect(parseMigrateFrom('chatgpt')).toBe('chatgpt');
    expect(parseMigrateFrom('claude')).toBe('claude');
    expect(parseMigrateFrom('GEMINI')).toBe('gemini');
    expect(parseMigrateFrom(' Copilot ')).toBe('copilot');
  });

  it.each(['', ' ', 'nope', 'clawdbot', '1', 'chat gpt'])('rejects invalid value %s', (value) => {
    expect(() => parseMigrateFrom(value)).toThrow(
      `Invalid --from value "${value}". Expected one of: chatgpt, claude, gemini, copilot.`,
    );
  });
});
