import { describe, expect, it } from 'vitest';
import { parseDoctorExclude, resolveDoctorSnapshots } from '../doctor.js';

describe('savestate doctor --exclude', () => {
  it('defaults to undefined', () => {
    expect(parseDoctorExclude(undefined)).toBeUndefined();
  });

  it('accepts known adapters', () => {
    expect(parseDoctorExclude('chatgpt')).toEqual(['chatgpt']);
    expect(parseDoctorExclude('claude-code, gemini')).toEqual(['claude-code', 'gemini']);
    expect(parseDoctorExclude('CHATGPT')).toEqual(['chatgpt']);
    expect(parseDoctorExclude(' Windsurf ')).toEqual(['windsurf']);
  });

  it.each(['', ' ', 'nope', 'claude', 'chatgpt,bogus', ',,'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseDoctorExclude(value)).toThrow(
        `Invalid --exclude value "${value}". Expected one or more of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf.`,
      );
    },
  );

  it('skips snapshots from excluded adapters', () => {
    expect(
      resolveDoctorSnapshots(
        [
          { id: 'gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code' },
        ],
        { exclude: 'chatgpt' },
      ).map((entry) => entry.id),
    ).toEqual(['claude']);
  });

  it('ANDs --adapter with --exclude', () => {
    expect(
      resolveDoctorSnapshots(
        [
          { id: 'gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'gemini', timestamp: '2026-06-01T00:00:00Z', adapter: 'gemini' },
        ],
        { adapter: 'chatgpt', exclude: 'chatgpt' },
      ).map((entry) => entry.id),
    ).toEqual([]);
    expect(
      resolveDoctorSnapshots(
        [
          { id: 'gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code' },
        ],
        { adapter: 'claude-code', exclude: 'chatgpt' },
      ).map((entry) => entry.id),
    ).toEqual(['claude']);
  });

  it('ANDs --exclude with --limit', () => {
    expect(
      resolveDoctorSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', adapter: 'claude-code' },
          { id: 'gpt', timestamp: '2026-05-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', adapter: 'claude-code' },
        ],
        { exclude: 'chatgpt', limit: '1' },
      ).map((entry) => entry.id),
    ).toEqual(['new']);
  });
});
