import { describe, expect, it } from 'vitest';
import { ListMemoriesInputSchema } from '../server.js';

describe('MCP list_memories schema', () => {
  it('collapses internal source whitespace to match stored labels', () => {
    expect(ListMemoriesInputSchema.parse({ source: '  Claude  Code\t' }).source).toBe('Claude Code');
  });

  it('rejects a blank source filter', () => {
    expect(() => ListMemoriesInputSchema.parse({ source: '   ' })).toThrow();
  });
});
