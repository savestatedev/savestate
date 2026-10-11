import { describe, expect, it } from 'vitest';
import { parseMemorySource } from '../memory-cli.js';
import { formatMemoryListSource } from '../memory.js';

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
