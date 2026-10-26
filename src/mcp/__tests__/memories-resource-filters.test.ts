import { describe, expect, it } from 'vitest';
import {
  buildMemoriesResourceUri,
  parseMemoriesResourceDate,
  parseMemoriesResourceImportance,
  parseMemoriesResourceSearch,
  parseMemoriesResourceSource,
  parseMemoriesResourceTag,
  parseMemoriesResourceType,
  validateMemoriesResourceImportanceRange,
  validateMemoriesResourceDateRange,
} from '../memories-resource-filters.js';

describe('MCP savestate://memories importance filters', () => {
  it('parses inclusive score bounds', () => {
    expect(parseMemoriesResourceImportance(' 0.25 ', 'minImportance')).toBe(0.25);
    expect(parseMemoriesResourceImportance('1', 'maxImportance')).toBe(1);
    expect(parseMemoriesResourceImportance(null, 'minImportance')).toBeUndefined();
  });

  it.each(['', 'nope', '-0.1', '1.1'])('rejects invalid score %j', (value) => {
    expect(() => parseMemoriesResourceImportance(value, 'minImportance')).toThrow(
      `Invalid minImportance value "${value}". Expected a number between 0 and 1.`,
    );
  });

  it('rejects an inverted range', () => {
    expect(() => validateMemoriesResourceImportanceRange(0.8, 0.2)).toThrow(
      'minImportance must be at or below maxImportance',
    );
  });

  it('parses and validates memory types', () => {
    expect(parseMemoriesResourceType(' preference ')).toBe('preference');
    expect(parseMemoriesResourceType(null)).toBeUndefined();
    expect(() => parseMemoriesResourceType('unknown')).toThrow(
      'Invalid type value "unknown". Expected one of: fact, event, preference, conversation.',
    );
  });

  it('parses non-empty tags', () => {
    expect(parseMemoriesResourceTag(' project ')).toBe('project');
    expect(parseMemoriesResourceTag(null)).toBeUndefined();
    expect(() => parseMemoriesResourceTag('   ')).toThrow(
      'Invalid tag value. Expected a non-empty tag.',
    );
  });

  it('parses non-empty search queries', () => {
    expect(parseMemoriesResourceSearch('  encrypted archive ')).toBe('encrypted archive');
    expect(parseMemoriesResourceSearch(null)).toBeUndefined();
    expect(() => parseMemoriesResourceSearch('   ')).toThrow(
      'Invalid search value. Expected a non-empty search query.',
    );
  });

  it('parses non-empty source filters', () => {
    expect(parseMemoriesResourceSource('  Claude-Code ')).toBe('Claude-Code');
    expect(parseMemoriesResourceSource(null)).toBeUndefined();
    expect(() => parseMemoriesResourceSource('   ')).toThrow(
      'Invalid source value. Expected a non-empty source.',
    );
  });

  it('normalizes inclusive ISO creation bounds', () => {
    expect(parseMemoriesResourceDate('2026-10-01', 'since')).toBe('2026-10-01T00:00:00.000Z');
    expect(parseMemoriesResourceDate('2026-10-01', 'until')).toBe('2026-10-01T23:59:59.999Z');
    expect(parseMemoriesResourceDate('2026-10-01T12:30:00-04:00', 'since')).toBe('2026-10-01T16:30:00.000Z');
    expect(() => parseMemoriesResourceDate('2026-02-30', 'since')).toThrow('Invalid since value');
    expect(() => parseMemoriesResourceDate('10/01/2026', 'since')).toThrow('Invalid since value');
  });

  it('rejects an inverted creation-date range', () => {
    expect(() => validateMemoriesResourceDateRange(
      parseMemoriesResourceDate('2026-10-02', 'since'),
      parseMemoriesResourceDate('2026-10-01', 'until'),
    )).toThrow('since must be at or before until');
  });

  it('keeps filters in pagination resource links', () => {
    expect(buildMemoriesResourceUri(0.4, 0.9, 'event', 'Claude-Code', 'project', 'encrypted archive', '2026-10-01T00:00:00.000Z', '2026-10-31T23:59:59.999Z')).toBe(
      'savestate://memories?type=event&source=Claude-Code&tag=project&search=encrypted+archive&since=2026-10-01T00%3A00%3A00.000Z&until=2026-10-31T23%3A59%3A59.999Z&minImportance=0.4&maxImportance=0.9',
    );
  });
});
