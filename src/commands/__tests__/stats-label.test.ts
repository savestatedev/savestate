import { describe, expect, it } from 'vitest';
import { applyStatsFilters, parseStatsLabel } from '../stats.js';
import type { SnapshotIndexEntry } from '../../index-file.js';

function entry(partial: Partial<SnapshotIndexEntry>): SnapshotIndexEntry {
  return {
    id: partial.id ?? 'ss-x',
    timestamp: partial.timestamp ?? '2026-01-01T00:00:00Z',
    platform: partial.platform ?? 'claude',
    adapter: partial.adapter ?? 'claude-code',
    filename: partial.filename ?? 'ss-x.saf.enc',
    size: partial.size ?? 1024,
    label: partial.label,
    tags: partial.tags,
  };
}

describe('savestate stats --label', () => {
  it('leaves the label unset when omitted', () => {
    expect(parseStatsLabel(undefined)).toBeUndefined();
  });

  it('accepts a single snapshot label', () => {
    expect(parseStatsLabel('backup')).toBe('backup');
    expect(parseStatsLabel('Pre-update backup')).toBe('Pre-update backup');
    expect(parseStatsLabel(' nightly ')).toBe('nightly');
  });

  it.each(['', ' ', ',', 'backup,nightly'])('rejects invalid value %s', (value) => {
    expect(() => parseStatsLabel(value)).toThrow(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  });

  it('keeps snapshots that match the label', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'backup', label: 'Pre-update backup' }),
          entry({ id: 'nightly', label: 'nightly' }),
        ],
        { label: 'Pre-update backup' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['backup']);
  });

  it('ANDs --adapter with --label', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'gpt-backup', adapter: 'chatgpt', label: 'backup' }),
          entry({ id: 'claude-backup', adapter: 'claude-code', label: 'backup' }),
          entry({ id: 'gpt-nightly', adapter: 'chatgpt', label: 'nightly' }),
        ],
        { adapter: 'chatgpt', label: 'backup' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['gpt-backup']);
  });

  it('ANDs --since and --until with --label', () => {
    expect(
      applyStatsFilters(
        [
          entry({ id: 'old', timestamp: '2026-01-01T00:00:00Z', label: 'backup' }),
          entry({ id: 'mid', timestamp: '2026-04-15T00:00:00Z', label: 'backup' }),
          entry({ id: 'new', timestamp: '2026-08-01T00:00:00Z', label: 'backup' }),
          entry({ id: 'mid-nightly', timestamp: '2026-04-15T00:00:00Z', label: 'nightly' }),
        ],
        { since: '2026-04-01', until: '2026-05-01', label: 'backup' },
      ).map((snapshot) => snapshot.id),
    ).toEqual(['mid']);
  });
});
