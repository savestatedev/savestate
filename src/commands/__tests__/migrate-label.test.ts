import { describe, expect, it } from 'vitest';
import { parseMigrateLabel, resolveMigrateSnapshot } from '../migrate.js';

describe('savestate migrate --label', () => {
  it('defaults to undefined', () => {
    expect(parseMigrateLabel(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot label', () => {
    expect(parseMigrateLabel('backup')).toBe('backup');
    expect(parseMigrateLabel('Pre-update backup')).toBe('Pre-update backup');
    expect(parseMigrateLabel(' nightly ')).toBe('nightly');
  });

  it.each(['', ' ', ',', 'backup,nightly'])('rejects invalid value %s', (value) => {
    expect(() => parseMigrateLabel(value)).toThrow(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  });

  it('picks the newest snapshot that matches the label', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', label: 'backup' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', label: 'backup' },
          { id: 'nightly', timestamp: '2026-09-01T00:00:00Z', label: 'nightly' },
        ],
        { label: 'backup' },
      ),
    ).toEqual('new');
  });

  it('ANDs --snapshot with --label', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'gpt-backup', timestamp: '2026-01-01T00:00:00Z', label: 'backup' },
          { id: 'claude-backup', timestamp: '2026-05-01T00:00:00Z', label: 'backup' },
          { id: 'gpt-nightly', timestamp: '2026-08-01T00:00:00Z', label: 'nightly' },
        ],
        { snapshot: 'claude-backup', label: 'backup' },
      ),
    ).toEqual('claude-backup');
  });

  it('returns undefined when --snapshot and --label do not match', () => {
    expect(
      resolveMigrateSnapshot(
        [
          { id: 'gpt-backup', timestamp: '2026-01-01T00:00:00Z', label: 'backup' },
          { id: 'gpt-nightly', timestamp: '2026-08-01T00:00:00Z', label: 'nightly' },
        ],
        { snapshot: 'gpt-nightly', label: 'backup' },
      ),
    ).toBeUndefined();
  });
});
