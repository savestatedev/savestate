import { describe, expect, it } from 'vitest';
import {
  buildMemoriesResourceUri,
  parseMemoriesResourceImportance,
  parseMemoriesResourceTag,
  parseMemoriesResourceType,
  validateMemoriesResourceImportanceRange,
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

  it('keeps filters in pagination resource links', () => {
    expect(buildMemoriesResourceUri(0.4, 0.9, 'event', 'project')).toBe(
      'savestate://memories?type=event&tag=project&minImportance=0.4&maxImportance=0.9',
    );
  });
});
