import { describe, expect, it } from 'vitest';
import { parseDoctorSince, resolveDoctorSnapshots } from '../doctor.js';

describe('savestate doctor --since', () => {
  it('leaves the cutoff unset when omitted', () => {
    expect(parseDoctorSince(undefined)).toBeUndefined();
  });

  it('accepts ISO 8601 dates', () => {
    expect(parseDoctorSince('2026-04-01')).toBe(new Date('2026-04-01').getTime());
    expect(parseDoctorSince('2026-04-01T00:00:00Z')).toBe(
      new Date('2026-04-01T00:00:00Z').getTime(),
    );
  });

  it.each(['', ' ', 'nope', '2026-13-01', 'not-a-date'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseDoctorSince(value)).toThrow(
        `Invalid --since value "${value}". Expected an ISO 8601 date.`,
      );
    },
  );

  it('skips snapshots older than the cutoff', () => {
    expect(
      resolveDoctorSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'new', timestamp: '2026-05-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { since: '2026-04-01' },
      ).map((entry) => entry.id),
    ).toEqual(['new']);
  });

  it('ANDs --adapter with --since', () => {
    expect(
      resolveDoctorSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'new-gpt', timestamp: '2026-05-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'new-claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code' },
        ],
        { adapter: 'chatgpt', since: '2026-04-01' },
      ).map((entry) => entry.id),
    ).toEqual(['new-gpt']);
  });

  it('ANDs --since with --until', () => {
    expect(
      resolveDoctorSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt' },
          { id: 'mid', timestamp: '2026-04-15T00:00:00Z', adapter: 'chatgpt' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt' },
        ],
        { since: '2026-04-01', until: '2026-05-01' },
      ).map((entry) => entry.id),
    ).toEqual(['mid']);
  });
});
