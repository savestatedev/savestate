import { describe, expect, it } from 'vitest';
import {
  buildSnapshotsResourceUri,
  formatSnapshotsResourceFilters,
  matchesSnapshotsResourcePlatform,
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

  it('matches platforms without making casing significant', () => {
    expect(matchesSnapshotsResourcePlatform('claude-code', 'CLAUDE-CODE')).toBe(true);
    expect(matchesSnapshotsResourcePlatform('gemini', 'claude-code')).toBe(false);
  });

  it('preserves the filter in pagination URIs', () => {
    expect(buildSnapshotsResourceUri()).toBe('savestate://snapshots');
    expect(buildSnapshotsResourceUri('Claude Code')).toBe(
      'savestate://snapshots?platform=Claude%20Code',
    );
  });

  it('echoes the active filter in response metadata', () => {
    expect(formatSnapshotsResourceFilters('Claude-Code')).toEqual({
      platform: 'Claude-Code',
    });
    expect(formatSnapshotsResourceFilters()).toEqual({ platform: null });
  });
});
