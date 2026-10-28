import { describe, expect, it } from 'vitest';
import { ListMemoriesInputSchema, SearchSnapshotsInputSchema, tools } from '../server.js';

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
  it('advertises the implemented default result limit', () => {
    expect(getTool('list_memories').description).toContain('default result limit is 50');
    expect((getTool('list_memories').inputSchema as any).properties.limit.description).toContain(
      'default: 50',
    );
  });

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

describe('MCP snapshot search schema', () => {
  it('explains phrase matching for agent-generated queries', () => {
    const tool = getTool('savestate_search_snapshots');
    const schema = tool.inputSchema as any;
    expect(tool.description).toContain('exact phrase matches rank highest');
    expect(schema.properties.query.description).toContain('Word or phrase');
  });

  it('advertises inclusive snapshot date bounds', () => {
    const schema = getTool('savestate_search_snapshots').inputSchema as any;
    expect(schema.properties.since).toMatchObject({ type: 'string' });
    expect(schema.properties.until).toMatchObject({ type: 'string' });
  });

  it('advertises snapshot label and tag filters', () => {
    const schema = getTool('savestate_search_snapshots').inputSchema as any;
    expect(schema.properties.label.description).toContain('case-insensitive');
    expect(schema.properties.tag.description).toContain('case-insensitive');
  });

  it('keeps advertised metadata filters in the runtime input schema', () => {
    expect(SearchSnapshotsInputSchema.parse({
      query: 'migration notes',
      label: 'weekly',
      tag: 'work',
      passphrase: 'test-passphrase',
    })).toMatchObject({
      query: 'migration notes',
      label: 'weekly',
      tag: 'work',
      passphrase: 'test-passphrase',
    });
  });
});
