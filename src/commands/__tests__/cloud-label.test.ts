import { describe, expect, it } from 'vitest';
import { parseCloudLabel, resolveCloudPushSnapshots } from '../cloud.js';

describe('savestate cloud --label', () => {
  it('defaults to undefined', () => {
    expect(parseCloudLabel(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot label', () => {
    expect(parseCloudLabel('backup')).toBe('backup');
    expect(parseCloudLabel('Pre-update backup')).toBe('Pre-update backup');
    expect(parseCloudLabel(' nightly ')).toBe('nightly');
  });

  it.each(['', ' ', ',', 'backup,nightly'])('rejects invalid value %s', (value) => {
    expect(() => parseCloudLabel(value)).toThrow(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  });

  it('picks the newest snapshot that matches the label', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', label: 'backup' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', label: 'backup' },
          { id: 'nightly', timestamp: '2026-09-01T00:00:00Z', label: 'nightly' },
        ],
        { label: 'backup' },
      ).map((entry) => entry.id),
    ).toEqual(['new']);
  });

  it('ANDs --id with --label', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old-backup', timestamp: '2026-01-01T00:00:00Z', label: 'backup' },
          { id: 'new-backup', timestamp: '2026-08-01T00:00:00Z', label: 'backup' },
          { id: 'nightly', timestamp: '2026-08-01T00:00:00Z', label: 'nightly' },
        ],
        { id: 'old-backup', label: 'backup' },
      ).map((entry) => entry.id),
    ).toEqual(['old-backup']);
  });

  it('returns empty when snapshot-id does not match --label', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'backup', timestamp: '2026-01-01T00:00:00Z', label: 'backup' },
          { id: 'nightly', timestamp: '2026-08-01T00:00:00Z', label: 'nightly' },
        ],
        { id: 'nightly', label: 'backup' },
      ),
    ).toEqual([]);
  });

  it('ANDs --adapter with --label', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt', label: 'backup' },
          { id: 'claude-backup', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code', label: 'backup' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt', label: 'backup' },
        ],
        { adapter: 'chatgpt', label: 'backup' },
      ).map((entry) => entry.id),
    ).toEqual(['new-gpt']);
  });

  it('ANDs --since with --label', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', label: 'backup' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z', label: 'backup' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', label: 'nightly' },
        ],
        { since: '2026-04-01', label: 'backup' },
      ).map((entry) => entry.id),
    ).toEqual(['mid']);
  });

  it('returns every matching snapshot with --all', () => {
    expect(
      resolveCloudPushSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', label: 'backup' },
          { id: 'mid', timestamp: '2026-05-01T00:00:00Z', label: 'nightly' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', label: 'backup' },
        ],
        { label: 'backup', all: true },
      ).map((entry) => entry.id),
    ).toEqual(['old', 'new']);
  });
});
