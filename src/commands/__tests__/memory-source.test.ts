import { describe, expect, it } from 'vitest';
import { parseMemoryFreshness, parseMemorySource, parseMemoryTags } from '../memory-cli.js';
import {
  formatMemoryListContent,
  formatMemoryListCreatedAt,
  formatMemoryListFreshness,
  formatMemoryListLastAccessed,
  formatMemoryListSource,
  formatMemoryListTags,
  filterMemoryListBySource,
  shouldShowMemoryListTags,
} from '../memory.js';

describe('savestate memory list --source', () => {
  it('trims a single source id', () => {
    expect(parseMemorySource('  claude-code  ')).toBe('claude-code');
    expect(parseMemorySource(undefined)).toBeUndefined();
  });

  it.each(['', '   ', 'claude code', 'user,agent'])('rejects invalid source %j', (value) => {
    expect(() => parseMemorySource(value)).toThrow(
      `Invalid --source value "${value}". Expected a single non-empty source id.`,
    );
  });

  it('matches source ids case-insensitively', () => {
    const entries = [
      { id: 'claude', content: 'a', source: 'Claude-Code', createdAt: '2026-09-01T00:00:00.000Z' },
      { id: 'chatgpt', content: 'b', source: 'chatgpt', createdAt: '2026-09-01T00:00:00.000Z' },
    ];

    expect(filterMemoryListBySource(entries, ' claude-code ').map(({ id }) => id)).toEqual(['claude']);
    expect(filterMemoryListBySource(entries)).toBe(entries);
  });
});

describe('savestate memory list --tags', () => {
  it('deduplicates tags case-insensitively while preserving first spelling', () => {
    expect(parseMemoryTags(' Work,urgent,work, URGENT ')).toEqual(['Work', 'urgent']);
  });
});

describe('savestate memory list --freshness', () => {
  it.each(['active', 'stale', 'needs_confirmation'])('accepts %s', (value) => {
    expect(parseMemoryFreshness(value)).toBe(value);
  });

  it('normalizes case and rejects unknown states', () => {
    expect(parseMemoryFreshness(' STALE ')).toBe('stale');
    expect(() => parseMemoryFreshness('expired')).toThrow(
      'Invalid --freshness value "expired". Expected one of active, stale, or needs_confirmation.',
    );
  });
});

describe('memory list table source display', () => {
  it('keeps short sources intact and truncates long sources', () => {
    expect(formatMemoryListSource('claude-code')).toBe('claude-code');
    expect(formatMemoryListSource('  a source with spaces  ')).toBe('a source with s...');
    expect(formatMemoryListSource('openai-assistants-production')).toBe('openai-assistan...');
  });
});

describe('memory list table access display', () => {
  it('formats valid access timestamps and handles missing or invalid values', () => {
    expect(formatMemoryListLastAccessed('2026-09-03T08:30:00.000Z')).toBe('2026-09-03');
    expect(formatMemoryListLastAccessed(undefined)).toBe('—');
    expect(formatMemoryListLastAccessed('not-a-date')).toBe('—');
  });
});

describe('memory list table creation display', () => {
  it('formats valid creation timestamps and handles invalid values', () => {
    expect(formatMemoryListCreatedAt('2026-09-03T08:30:00.000Z')).toBe('2026-09-03');
    expect(formatMemoryListCreatedAt('not-a-date')).toBe('—');
  });
});

describe('memory list table freshness display', () => {
  it('formats active and confirmation states compactly', () => {
    const now = new Date('2026-10-15T12:00:00.000Z');
    expect(formatMemoryListFreshness({
      id: 'fresh', content: 'fresh', source: 'test', createdAt: '2026-10-15T11:00:00.000Z',
      freshnessClass: 'fast', lastVerifiedAt: '2026-10-15T10:00:00.000Z',
    }, now)).toBe('active');
    expect(formatMemoryListFreshness({
      id: 'old', content: 'old', source: 'test', createdAt: '2026-08-01T00:00:00.000Z',
      freshnessClass: 'medium', lastVerifiedAt: '2026-09-01T00:00:00.000Z',
    }, now)).toBe('confirm');
  });
});

describe('memory list table content display', () => {
  it('does not add an ellipsis to short content', () => {
    expect(formatMemoryListContent('Use dark mode')).toBe('Use dark mode');
  });

  it('truncates long content and adds an ellipsis', () => {
    expect(formatMemoryListContent('1234567890', 5)).toBe('12345...');
  });

  it('keeps table previews on one line', () => {
    expect(formatMemoryListContent('line one\nline two')).toBe('line one line two');
  });

  it('flattens CRLF, tabs, and repeated whitespace', () => {
    expect(formatMemoryListContent('\r\n\tline one\r\n\tline   two  ')).toBe('line one line two');
  });

  it('does not split astral Unicode characters when truncating', () => {
    expect(formatMemoryListContent('😀😀😀', 2)).toBe('😀😀...');
  });
});

describe('memory list table tag display', () => {
  it('normalizes and truncates tags for compact rows', () => {
    expect(formatMemoryListTags({
      id: 'mem-tags',
      content: 'tagged',
      source: 'user',
      createdAt: '2026-09-01T00:00:00.000Z',
      metadata: { tags: [' work ', 'urgent', 'urgent'] },
    })).toBe('work, urgent');
    expect(formatMemoryListTags({
      id: 'mem-long-tags',
      content: 'tagged',
      source: 'user',
      createdAt: '2026-09-01T00:00:00.000Z',
      metadata: { tags: ['abcdefghijklmnop', 'urgent'] },
    }, 12)).toBe('abcdefghi...');
    expect(formatMemoryListTags({
      id: 'mem-no-tags',
      content: 'untagged',
      source: 'user',
      createdAt: '2026-09-01T00:00:00.000Z',
    })).toBe('—');
  });

  it('shows the tags column only when the collection contains tags', () => {
    const base = {
      id: 'mem',
      content: 'memory',
      source: 'user',
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    expect(shouldShowMemoryListTags([base])).toBe(false);
    expect(shouldShowMemoryListTags([{ ...base, metadata: { tags: ['work'] } }])).toBe(true);
  });
});
