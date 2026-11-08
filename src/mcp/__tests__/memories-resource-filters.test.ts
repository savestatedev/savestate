import { describe, expect, it } from 'vitest';
import {
  buildMemoriesResourceUri,
  formatMemoriesResourceFilters,
  memoriesResourceNamespacesMatch,
  parseMemoriesResourceDate,
  parseMemoriesResourceImportance,
  parseMemoriesResourceNamespace,
  parseMemoriesResourcePath,
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

  it.each(['', 'nope', '-0.1', '1.1', '0x1', '1e-1'])('rejects invalid score %j', (value) => {
    expect(() => parseMemoriesResourceImportance(value, 'minImportance')).toThrow(
      `Invalid minImportance value "${value}". Expected a number between 0 and 1.`,
    );
  });

  it('accepts decimal scores without requiring a leading zero', () => {
    expect(parseMemoriesResourceImportance('.75', 'maxImportance')).toBe(0.75);
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
    expect(parseMemoriesResourceSource('  Claude  Code\t')).toBe('Claude Code');
    expect(parseMemoriesResourceSource(null)).toBeUndefined();
    expect(() => parseMemoriesResourceSource('   ')).toThrow(
      'Invalid source value. Expected a non-empty source.',
    );
  });

  it('parses valid namespaces and rejects ambiguous scopes', () => {
    expect(parseMemoriesResourceNamespace('  org:app:agent:user ')).toBe('org:app:agent:user');
    expect(parseMemoriesResourceNamespace(' org:app:agent ')).toBe('org:app:agent');
    expect(parseMemoriesResourceNamespace(null)).toBeUndefined();
    expect(() => parseMemoriesResourceNamespace('   ')).toThrow('Invalid namespace value');
    expect(() => parseMemoriesResourceNamespace('org:app')).toThrow('Invalid namespace value');
    expect(() => parseMemoriesResourceNamespace('org:app:agent,other')).toThrow('Invalid namespace value');
  });

  it('parses the namespace resource path, including encoded separators', () => {
    expect(parseMemoriesResourcePath('/org:app:agent')).toBe('org:app:agent');
    expect(parseMemoriesResourcePath('/org%3Aapp%3Aagent%3Auser')).toBe('org:app:agent:user');
    expect(parseMemoriesResourcePath('/')).toBeUndefined();
    expect(() => parseMemoriesResourcePath('//org:app:agent')).toThrow(
      'Invalid memory resource path',
    );
    expect(() => parseMemoriesResourcePath('/org:app:agent/other')).toThrow(
      'Invalid memory resource path',
    );
  });

  it('keeps equivalent namespace path and query scopes case-insensitive', () => {
    const pathNamespace = parseMemoriesResourcePath('/Org:App:Agent');
    const queryNamespace = parseMemoriesResourceNamespace('org:app:agent');

    expect(memoriesResourceNamespacesMatch(pathNamespace, queryNamespace)).toBe(true);
    expect(memoriesResourceNamespacesMatch(pathNamespace, 'org:app:other')).toBe(false);
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
    expect(buildMemoriesResourceUri(0.4, 0.9, 'event', 'Claude-Code', 'org:app:agent', 'project', 'encrypted archive', '2026-10-01T00:00:00.000Z', '2026-10-31T23:59:59.999Z')).toBe(
      'savestate://memories/org%3Aapp%3Aagent?type=event&source=Claude-Code&tag=project&search=encrypted+archive&since=2026-10-01T00%3A00%3A00.000Z&until=2026-10-31T23%3A59%3A59.999Z&minImportance=0.4&maxImportance=0.9',
    );
  });

  it('echoes the source filter in resource response metadata', () => {
    expect(formatMemoriesResourceFilters(
      'event',
      'Claude-Code',
      'org:app:agent',
      'project',
      'encrypted archive',
      '2026-10-01T00:00:00.000Z',
      '2026-10-31T23:59:59.999Z',
      0.4,
      0.9,
    )).toEqual({
      type: 'event',
      source: 'Claude-Code',
      namespace: 'org:app:agent',
      tag: 'project',
      search: 'encrypted archive',
      since: '2026-10-01T00:00:00.000Z',
      until: '2026-10-31T23:59:59.999Z',
      minImportance: 0.4,
      maxImportance: 0.9,
    });
  });
});
