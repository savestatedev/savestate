import { describe, expect, it } from 'vitest';
import { parseMemorySource } from '../memory-cli.js';
import {
  formatMemoryListContent,
  formatMemoryListLastAccessed,
  formatMemoryListSource,
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
    expect(formatMemoryListContent('line one\r\n\tline   two')).toBe('line one line two');
  });
});
