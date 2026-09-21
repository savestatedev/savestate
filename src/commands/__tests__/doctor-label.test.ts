import { describe, expect, it } from 'vitest';
import { parseDoctorLabel, resolveDoctorSnapshots } from '../doctor.js';

describe('savestate doctor --label', () => {
  it('defaults to undefined', () => {
    expect(parseDoctorLabel(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot label', () => {
    expect(parseDoctorLabel('backup')).toBe('backup');
    expect(parseDoctorLabel('Pre-update backup')).toBe('Pre-update backup');
    expect(parseDoctorLabel(' nightly ')).toBe('nightly');
  });

  it.each(['', ' ', ',', 'backup,nightly'])('rejects invalid value %s', (value) => {
    expect(() => parseDoctorLabel(value)).toThrow(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  });

  it('keeps snapshots that match the label', () => {
    expect(
      resolveDoctorSnapshots(
        [
          { id: 'backup', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt', label: 'Pre-update backup' },
          { id: 'nightly', timestamp: '2026-05-01T00:00:00Z', adapter: 'chatgpt', label: 'nightly' },
        ],
        { label: 'Pre-update backup' },
      ).map((entry) => entry.id),
    ).toEqual(['backup']);
  });

  it('ANDs --adapter with --label', () => {
    expect(
      resolveDoctorSnapshots(
        [
          { id: 'gpt-backup', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt', label: 'backup' },
          { id: 'claude-backup', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code', label: 'backup' },
          { id: 'gpt-nightly', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt', label: 'nightly' },
        ],
        { adapter: 'chatgpt', label: 'backup' },
      ).map((entry) => entry.id),
    ).toEqual(['gpt-backup']);
  });

  it('ANDs --since and --until with --label', () => {
    expect(
      resolveDoctorSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt', label: 'backup' },
          { id: 'mid', timestamp: '2026-04-15T00:00:00Z', adapter: 'chatgpt', label: 'backup' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt', label: 'backup' },
          { id: 'mid-nightly', timestamp: '2026-04-15T00:00:00Z', adapter: 'chatgpt', label: 'nightly' },
        ],
        { since: '2026-04-01', until: '2026-05-01', label: 'backup' },
      ).map((entry) => entry.id),
    ).toEqual(['mid']);
  });
});
