import { describe, expect, it } from 'vitest';
import { parseSearchLabel, resolveSearchSnapshots } from '../search.js';

describe('savestate search --label', () => {
  it('defaults to undefined', () => {
    expect(parseSearchLabel(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot label', () => {
    expect(parseSearchLabel('backup')).toBe('backup');
    expect(parseSearchLabel('Pre-update backup')).toBe('Pre-update backup');
    expect(parseSearchLabel(' nightly ')).toBe('nightly');
  });

  it.each(['', ' ', ',', 'backup,nightly'])('rejects invalid value %s', (value) => {
    expect(() => parseSearchLabel(value)).toThrow(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  });

  it('keeps snapshots that match the label', () => {
    expect(
      resolveSearchSnapshots(
        [
          { id: 'backup', timestamp: '2026-01-01T00:00:00Z', label: 'Pre-update backup' },
          { id: 'nightly', timestamp: '2026-05-01T00:00:00Z', label: 'nightly' },
        ],
        { label: 'Pre-update backup' },
      ),
    ).toEqual(['backup']);
  });

  it('ANDs --adapter with --label', () => {
    expect(
      resolveSearchSnapshots(
        [
          { id: 'gpt-backup', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt', label: 'backup' },
          { id: 'claude-backup', timestamp: '2026-05-01T00:00:00Z', adapter: 'claude-code', label: 'backup' },
          { id: 'gpt-nightly', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt', label: 'nightly' },
        ],
        { adapter: 'chatgpt', label: 'backup' },
      ),
    ).toEqual(['gpt-backup']);
  });

  it('ANDs --since and --until with --label', () => {
    expect(
      resolveSearchSnapshots(
        [
          { id: 'old', timestamp: '2026-01-01T00:00:00Z', adapter: 'chatgpt', label: 'backup' },
          { id: 'mid', timestamp: '2026-04-15T00:00:00Z', adapter: 'chatgpt', label: 'backup' },
          { id: 'new', timestamp: '2026-08-01T00:00:00Z', adapter: 'chatgpt', label: 'backup' },
          { id: 'mid-nightly', timestamp: '2026-04-15T00:00:00Z', adapter: 'chatgpt', label: 'nightly' },
        ],
        { since: '2026-04-01', until: '2026-05-01', label: 'backup' },
      ),
    ).toEqual(['mid']);
  });
});
