import { describe, expect, it } from 'vitest';
import {
  buildSnapshotsResourceUri,
  formatSnapshotsResourceFilters,
  matchesSnapshotsResourceAdapter,
  matchesSnapshotsResourceDateRange,
  matchesSnapshotsResourceLabel,
  matchesSnapshotsResourcePlatform,
  matchesSnapshotsResourceTag,
  normalizeSnapshotsResourceLabel,
  normalizeSnapshotsResourceTags,
  parseSnapshotsResourceAdapter,
  parseSnapshotsResourceDate,
  parseSnapshotsResourceLabel,
  parseSnapshotsResourcePlatform,
  parseSnapshotsResourceTag,
  validateSnapshotsResourceDateRange,
} from '../snapshots-resource-filters.js';

describe('MCP savestate://snapshots platform filter', () => {
  it('normalizes a non-empty platform filter', () => {
    expect(parseSnapshotsResourcePlatform('  Claude-Code  ')).toBe('Claude-Code');
    expect(parseSnapshotsResourcePlatform(null)).toBeUndefined();
  });

  it('rejects a blank platform filter', () => {
    expect(() => parseSnapshotsResourcePlatform('   ')).toThrow(
      'Invalid platform value. Expected a non-empty platform.',
    );
  });

  it('normalizes and matches an adapter filter case-insensitively', () => {
    expect(parseSnapshotsResourceAdapter('  Claude-Code  ')).toBe('Claude-Code');
    expect(matchesSnapshotsResourceAdapter('claude-code', 'CLAUDE-CODE')).toBe(true);
    expect(matchesSnapshotsResourceAdapter('gemini', 'claude-code')).toBe(false);
  });

  it('rejects a blank adapter filter', () => {
    expect(() => parseSnapshotsResourceAdapter('   ')).toThrow(
      'Invalid adapter value. Expected a non-empty adapter.',
    );
  });

  it('normalizes and matches a label filter case-insensitively', () => {
    expect(parseSnapshotsResourceLabel('  Daily Backup  ')).toBe('Daily Backup');
    expect(parseSnapshotsResourceLabel(null)).toBeUndefined();
    expect(matchesSnapshotsResourceLabel('daily backup', 'DAILY BACKUP')).toBe(true);
    expect(matchesSnapshotsResourceLabel(null, 'daily backup')).toBe(false);
    expect(matchesSnapshotsResourceLabel(undefined, 'daily backup')).toBe(false);
  });

  it('normalizes missing and whitespace-only labels to null', () => {
    expect(normalizeSnapshotsResourceLabel('  Daily backup  ')).toBe('Daily backup');
    expect(normalizeSnapshotsResourceLabel('   ')).toBeNull();
    expect(normalizeSnapshotsResourceLabel(null)).toBeNull();
  });

  it('rejects a blank label filter', () => {
    expect(() => parseSnapshotsResourceLabel('   ')).toThrow(
      'Invalid label value. Expected a non-empty label.',
    );
  });

  it('normalizes and matches a tag filter case-insensitively', () => {
    expect(parseSnapshotsResourceTag('  RELEASE  ')).toBe('release');
    expect(parseSnapshotsResourceTag(null)).toBeUndefined();
    expect(matchesSnapshotsResourceTag(['release', 'backup'], 'RELEASE')).toBe(true);
    expect(matchesSnapshotsResourceTag(undefined, 'release')).toBe(false);
  });

  it('rejects a blank tag filter', () => {
    expect(() => parseSnapshotsResourceTag('   ')).toThrow(
      'Invalid tag value. Expected a non-empty tag.',
    );
  });

  it('normalizes missing, blank, and duplicate snapshot tags', () => {
    expect(normalizeSnapshotsResourceTags([' RELEASE ', 'release', '', 'BACKUP'])).toEqual([
      'backup',
      'release',
    ]);
    expect(normalizeSnapshotsResourceTags(undefined)).toEqual([]);
  });

  it('sorts normalized tags for stable resource output', () => {
    expect(normalizeSnapshotsResourceTags(['zeta', 'Alpha', 'beta'])).toEqual([
      'alpha',
      'beta',
      'zeta',
    ]);
  });

  it('normalizes inclusive ISO date bounds', () => {
    expect(parseSnapshotsResourceDate('2026-10-01', 'since')).toBe('2026-10-01T00:00:00.000Z');
    expect(parseSnapshotsResourceDate('2026-10-01', 'until')).toBe('2026-10-01T23:59:59.999Z');
    expect(parseSnapshotsResourceDate('2026-10-01T12:30:00-04:00', 'since')).toBe('2026-10-01T16:30:00.000Z');
    expect(parseSnapshotsResourceDate(null, 'since')).toBeUndefined();
  });

  it('rejects invalid or reversed date bounds', () => {
    expect(() => parseSnapshotsResourceDate('2026-02-30', 'since')).toThrow(
      'Invalid since value "2026-02-30". Expected an ISO-8601 date or timestamp.',
    );
    expect(() => validateSnapshotsResourceDateRange(
      '2026-10-02T00:00:00.000Z',
      '2026-10-01T23:59:59.999Z',
    )).toThrow('since must be at or before until');
  });

  it('matches snapshot timestamps inclusively', () => {
    expect(matchesSnapshotsResourceDateRange(
      '2026-10-01T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z',
      '2026-10-01T23:59:59.999Z',
    )).toBe(true);
    expect(matchesSnapshotsResourceDateRange(
      '2026-09-30T23:59:59.999Z',
      '2026-10-01T00:00:00.000Z',
    )).toBe(false);
    expect(matchesSnapshotsResourceDateRange('not-a-date', '2026-10-01T00:00:00.000Z')).toBe(false);
  });

  it('matches platforms without making casing significant', () => {
    expect(matchesSnapshotsResourcePlatform('claude-code', 'CLAUDE-CODE')).toBe(true);
    expect(matchesSnapshotsResourcePlatform('gemini', 'claude-code')).toBe(false);
  });

  it('ignores incidental whitespace in stored platform values', () => {
    expect(matchesSnapshotsResourcePlatform('  claude-code  ', 'claude-code')).toBe(true);
  });

  it('preserves the filter in pagination URIs', () => {
    expect(buildSnapshotsResourceUri()).toBe('savestate://snapshots');
    expect(buildSnapshotsResourceUri('Claude Code')).toBe(
      'savestate://snapshots?platform=Claude%20Code',
    );
    expect(buildSnapshotsResourceUri('Claude Code', 'Claude-Code')).toBe(
      'savestate://snapshots?platform=Claude%20Code&adapter=Claude-Code',
    );
    expect(buildSnapshotsResourceUri('Claude Code', 'Claude-Code', 'Daily backup')).toBe(
      'savestate://snapshots?platform=Claude%20Code&adapter=Claude-Code&label=Daily%20backup',
    );
    expect(buildSnapshotsResourceUri('Claude Code', 'Claude-Code', 'Daily backup', 'release')).toBe(
      'savestate://snapshots?platform=Claude%20Code&adapter=Claude-Code&label=Daily%20backup&tag=release',
    );
    expect(buildSnapshotsResourceUri(
      undefined,
      undefined,
      undefined,
      undefined,
      '2026-10-01T00:00:00.000Z',
      '2026-10-01T23:59:59.999Z',
    )).toBe(
      'savestate://snapshots?since=2026-10-01T00%3A00%3A00.000Z&until=2026-10-01T23%3A59%3A59.999Z',
    );
  });

  it('echoes the active filter in response metadata', () => {
    expect(formatSnapshotsResourceFilters('Claude-Code', 'claude-code', 'Daily backup', 'release')).toEqual({
      platform: 'Claude-Code',
      adapter: 'claude-code',
      label: 'Daily backup',
      tag: 'release',
      since: null,
      until: null,
    });
    expect(formatSnapshotsResourceFilters()).toEqual({
      platform: null,
      adapter: null,
      label: null,
      tag: null,
      since: null,
      until: null,
    });
  });

  it('keeps the active label available as response metadata', () => {
    const filters = formatSnapshotsResourceFilters(
      undefined,
      undefined,
      'Daily backup',
      undefined,
      '2026-10-01T00:00:00.000Z',
      '2026-10-01T23:59:59.999Z',
    );

    expect(filters.label).toBe('Daily backup');
    expect(filters.since).toBe('2026-10-01T00:00:00.000Z');
    expect(filters.until).toBe('2026-10-01T23:59:59.999Z');
  });
});
