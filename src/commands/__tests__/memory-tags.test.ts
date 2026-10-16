import { describe, expect, it } from 'vitest';
import { parseMemoryTags } from '../memory-cli.js';
import { filterMemoryExplainEntries, filterMemoryListByTags } from '../memory.js';

describe('savestate memory --tags', () => {
  it('defaults to undefined', () => {
    expect(parseMemoryTags(undefined)).toBeUndefined();
  });

  it('accepts one or more memory tags', () => {
    expect(parseMemoryTags('prefs')).toEqual(['prefs']);
    expect(parseMemoryTags('important,v2')).toEqual(['important', 'v2']);
    expect(parseMemoryTags(' weekly , backup ')).toEqual(['weekly', 'backup']);
    expect(parseMemoryTags('prefs,weekly,prefs')).toEqual(['prefs', 'weekly']);
  });

  it.each(['', ' ', ',', 'prefs,', ',v2', 'a,,b'])('rejects invalid value %s', (value) => {
    expect(() => parseMemoryTags(value)).toThrow(
      `Invalid --tags value "${value}". Expected one or more non-empty memory tags (comma-separated).`,
    );
  });

  it('matches tags case-insensitively', () => {
    const matching = {
      id: 'matching',
      content: 'matching',
      source: 'user',
      createdAt: '2026-09-01T00:00:00.000Z',
      metadata: { tags: ['Work', 'Urgent'] },
    };
    const other = { ...matching, id: 'other', metadata: { tags: ['personal'] } };

    expect(filterMemoryListByTags([matching, other], [' work ', 'URGENT'])).toEqual([matching]);
  });

  it('applies case-insensitive all-tag matching within explain scope', () => {
    const matching = {
      id: 'matching',
      content: 'inbox preference',
      source: 'ChatGPT',
      createdAt: '2026-09-01T00:00:00.000Z',
      metadata: { namespace: 'org:app:agent', tags: ['Work', 'Urgent'] },
    };
    const wrongSource = { ...matching, id: 'wrong-source', source: 'Claude' };
    const wrongTag = { ...matching, id: 'wrong-tag', metadata: { ...matching.metadata, tags: ['Work'] } };

    expect(filterMemoryExplainEntries(
      [matching, wrongSource, wrongTag],
      {
        namespace: 'org:app:agent',
        source: 'chatgpt',
        tags: [' work ', 'URGENT'],
      },
    )).toEqual([matching]);
  });
});
