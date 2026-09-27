import { describe, expect, it } from 'vitest';
import { parseDiffLabel, resolveDiffSnapshot } from '../diff.js';

describe('savestate diff --label', () => {
  it('defaults to undefined', () => {
    expect(parseDiffLabel(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot label', () => {
    expect(parseDiffLabel('backup')).toBe('backup');
    expect(parseDiffLabel('Pre-update backup')).toBe('Pre-update backup');
    expect(parseDiffLabel(' nightly ')).toBe('nightly');
  });

  it.each(['', ' ', ',', 'backup,nightly'])('rejects invalid value %s', (value) => {
    expect(() => parseDiffLabel(value)).toThrow(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  });

  it('picks the newest snapshot that matches the label', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', label: 'backup' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', label: 'backup' },
          { id: 'nightly', timestamp: '2026-09-01T00:00:00Z', label: 'nightly' },
        ],
        { snapshot: 'latest', label: 'backup' },
      ),
    ).toEqual('new');
  });

  it('ANDs --adapter with --label', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'old-gpt', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt', label: 'backup' },
          { id: 'mid-claude', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code', label: 'backup' },
          { id: 'new-gpt', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt', label: 'nightly' },
        ],
        { snapshot: 'latest', adapter: 'chatgpt', label: 'backup' },
      ),
    ).toEqual('old-gpt');
  });

  it('returns undefined when snapshot-id and --label do not match', () => {
    expect(
      resolveDiffSnapshot(
        [
          { id: 'gpt-backup', timestamp: '2026-01-01T00:00:00Z', label: 'backup' },
          { id: 'gpt-nightly', timestamp: '2026-08-01T00:00:00Z', label: 'nightly' },
        ],
        { snapshot: 'gpt-nightly', label: 'backup' },
      ),
    ).toBeUndefined();
  });
});
