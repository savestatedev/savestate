import { describe, expect, it } from 'vitest';
import { parseRestoreLabel, resolveRestoreSnapshot } from '../restore.js';

describe('savestate restore --label', () => {
  it('defaults to undefined', () => {
    expect(parseRestoreLabel(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot label', () => {
    expect(parseRestoreLabel('backup')).toBe('backup');
    expect(parseRestoreLabel('Pre-update backup')).toBe('Pre-update backup');
    expect(parseRestoreLabel(' nightly ')).toBe('nightly');
  });

  it.each(['', ' ', ',', 'backup,nightly'])('rejects invalid value %s', (value) => {
    expect(() => parseRestoreLabel(value)).toThrow(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  });

  it('picks the newest snapshot that matches the label', () => {
    expect(
      resolveRestoreSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', label: 'backup' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', label: 'backup' },
          { id: 'nightly', timestamp: '2026-09-01T00:00:00Z', label: 'nightly' },
        ],
        { label: 'backup' },
      ),
    ).toEqual('new');
  });

  it('ANDs snapshot-id with --label', () => {
    expect(
      resolveRestoreSnapshot(
        [
          { id: 'gpt-backup', timestamp: '2026-01-01T00:00:00Z', label: 'backup' },
          { id: 'claude-backup', timestamp: '2026-05-01T00:00:00Z', label: 'backup' },
          { id: 'gpt-nightly', timestamp: '2026-08-01T00:00:00Z', label: 'nightly' },
        ],
        { snapshot: 'claude-backup', label: 'backup' },
      ),
    ).toEqual('claude-backup');
  });

  it('returns undefined when snapshot-id and --label do not match', () => {
    expect(
      resolveRestoreSnapshot(
        [
          { id: 'gpt-backup', timestamp: '2026-01-01T00:00:00Z', label: 'backup' },
          { id: 'gpt-nightly', timestamp: '2026-08-01T00:00:00Z', label: 'nightly' },
        ],
        { snapshot: 'gpt-nightly', label: 'backup' },
      ),
    ).toBeUndefined();
  });
});
