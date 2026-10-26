import { describe, expect, it } from 'vitest';
import { ListMemoriesInputSchema, tools } from '../server.js';

function getTool(name: string) {
  const tool = tools.find((candidate) => candidate.name === name);
  expect(tool).toBeDefined();
  return tool!;
}

describe('MCP importance tool schemas', () => {
  it('advertises bounded importance values for storage', () => {
    const schema = getTool('savestate_memory_store').inputSchema as any;
    expect(schema.properties.importance).toMatchObject({
      type: 'number',
      minimum: 0,
      maximum: 1,
    });
  });

  it.each(['savestate_memory_search', 'search_memory', 'list_memories'])
    ('advertises bounded importance filters for %s', (name) => {
      const schema = getTool(name).inputSchema as any;
      expect(schema.properties.minImportance).toMatchObject({ minimum: 0, maximum: 1 });
      expect(schema.properties.maxImportance).toMatchObject({ minimum: 0, maximum: 1 });
    });
});

describe('MCP list_memories search schema', () => {
  it('advertises a text filter', () => {
    const schema = getTool('list_memories').inputSchema as any;
    expect(schema.properties.search).toMatchObject({ type: 'string' });
  });

  it('advertises a metadata source filter', () => {
    const schema = getTool('list_memories').inputSchema as any;
    expect(schema.properties.source).toMatchObject({ type: 'string' });
    expect(schema.properties.source.description).toContain('case-insensitive');
  });

  it('normalizes and rejects blank metadata source filters', () => {
    expect(ListMemoriesInputSchema.parse({ source: '  Claude-Code ' }).source).toBe('Claude-Code');
    expect(() => ListMemoriesInputSchema.parse({ source: '   ' })).toThrow();
  });
});
