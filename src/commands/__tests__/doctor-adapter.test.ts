import { describe, expect, it } from 'vitest';
import { parseDoctorAdapter } from '../doctor.js';

describe('savestate doctor --adapter', () => {
  it('defaults to undefined', () => {
    expect(parseDoctorAdapter(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseDoctorAdapter('chatgpt')).toBe('chatgpt');
    expect(parseDoctorAdapter('claude-code')).toBe('claude-code');
    expect(parseDoctorAdapter('CLAUDE-WEB')).toBe('claude-web');
    expect(parseDoctorAdapter(' Windsurf ')).toBe('windsurf');
  });

  it.each(['', ' ', 'nope', 'claude', '1', 'chat gpt'])('rejects invalid value %s', (value) => {
    expect(() => parseDoctorAdapter(value)).toThrow(
      `Invalid --adapter value "${value}". Expected one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
    );
  });
});
