import { describe, expect, it } from 'vitest';
import {
  buildSnapshotsResourceUri,
  formatSnapshotsResourceFilters,
  matchesSnapshotsResourceAdapter,
  matchesSnapshotsResourcePlatform,
  parseSnapshotsResourceAdapter,
  parseSnapshotsResourcePlatform,
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
  });

  it('echoes the active filter in response metadata', () => {
    expect(formatSnapshotsResourceFilters('Claude-Code', 'claude-code')).toEqual({
      platform: 'Claude-Code',
      adapter: 'claude-code',
    });
    expect(formatSnapshotsResourceFilters()).toEqual({ platform: null, adapter: null });
  });
});
