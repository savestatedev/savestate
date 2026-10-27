import { describe, expect, it } from 'vitest';
import {
  buildSnapshotsResourceUri,
  formatSnapshotsResourceFilters,
  matchesSnapshotsResourceAdapter,
  matchesSnapshotsResourceLabel,
  matchesSnapshotsResourcePlatform,
  matchesSnapshotsResourceTag,
  normalizeSnapshotsResourceLabel,
  normalizeSnapshotsResourceTags,
  parseSnapshotsResourceAdapter,
  parseSnapshotsResourceLabel,
  parseSnapshotsResourcePlatform,
  parseSnapshotsResourceTag,
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
      'release',
      'backup',
    ]);
    expect(normalizeSnapshotsResourceTags(undefined)).toEqual([]);
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
  });

  it('echoes the active filter in response metadata', () => {
    expect(formatSnapshotsResourceFilters('Claude-Code', 'claude-code', 'Daily backup', 'release')).toEqual({
      platform: 'Claude-Code',
      adapter: 'claude-code',
      label: 'Daily backup',
      tag: 'release',
    });
    expect(formatSnapshotsResourceFilters()).toEqual({ platform: null, adapter: null, label: null, tag: null });
  });

  it('keeps the active label available as response metadata', () => {
    const filters = formatSnapshotsResourceFilters(undefined, undefined, 'Daily backup');

    expect(filters.label).toBe('Daily backup');
  });
});
