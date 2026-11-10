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
  it.each(['search_memory', 'list_memories'])('documents all-tag matching for %s', (name) => {
    expect((getTool(name).inputSchema as any).properties.tags.description).toContain(
      'all requested tags must match',
    );
  });

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

  it('normalizes and rejects blank text filters', () => {
    expect(ListMemoriesInputSchema.parse({ search: '  encrypted archive ' }).search).toBe(
      'encrypted archive',
    );
    expect(() => ListMemoriesInputSchema.parse({ search: '   ' })).toThrow();
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

  it('advertises and enforces bounded integer pagination', () => {
    const schema = getTool('list_memories').inputSchema as any;
    expect(schema.properties.limit).toMatchObject({
      type: 'number',
      minimum: 1,
      maximum: 1000,
      multipleOf: 1,
      default: 50,
    });
    expect(schema.properties.offset).toMatchObject({
      type: 'number',
      minimum: 0,
      maximum: 1000,
      multipleOf: 1,
      default: 0,
    });
    expect(ListMemoriesInputSchema.parse({ limit: 50, offset: 0 })).toMatchObject({
      limit: 50,
      offset: 0,
    });
    expect(() => ListMemoriesInputSchema.parse({ limit: 1.5 })).toThrow();
    expect(() => ListMemoriesInputSchema.parse({ offset: 1001 })).toThrow();
  });
});

describe('MCP snapshot search schema', () => {
  it('explains phrase matching for agent-generated queries', () => {
    const tool = getTool('savestate_search_snapshots');
    const schema = tool.inputSchema as any;
    expect(tool.description).toContain('exact phrase matches rank highest');
    expect(schema.properties.query.description).toContain('Word or phrase');
  });

  it('advertises every snapshot scope filter', () => {
    expect(getTool('savestate_search_snapshots').description).toContain(
      'type, inclusive since/until date, label, and tag filters',
    );
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
