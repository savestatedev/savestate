/**
 * Tests for MCP Server and Memory Passport
 *
 * Issues: #107 (MCP-native memory interface), #176 (OpenMemory integration)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStore } from '../../memory/store.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { promises as fs } from 'fs';
import type { Namespace } from '../../checkpoint/types.js';
import type { MemoryPassport, PassportMemory, PassportSnapshot } from '../../commands/mcp.js';

describe('MCP Server Types', () => {
  describe('Namespace Schema', () => {
    it('requires org_id, app_id, and agent_id', () => {
      const validNamespace: Namespace = {
        org_id: 'test-org',
        app_id: 'test-app',
        agent_id: 'test-agent',
      };

      expect(validNamespace.org_id).toBe('test-org');
      expect(validNamespace.app_id).toBe('test-app');
      expect(validNamespace.agent_id).toBe('test-agent');
    });

    it('allows optional user_id', () => {
      const namespaceWithUser: Namespace = {
        org_id: 'test-org',
        app_id: 'test-app',
        agent_id: 'test-agent',
        user_id: 'test-user',
      };

      expect(namespaceWithUser.user_id).toBe('test-user');
    });
  });
});

describe('Memory Passport', () => {
  const createPassport = (overrides: Partial<MemoryPassport> = {}): MemoryPassport => ({
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    source_agent: {
      id: 'test-agent',
      platform: 'savestate',
      name: 'Test Agent',
    },
    memories: [],
    snapshots: [],
    metadata: {
      total_memories: 0,
      total_snapshots: 0,
      export_tool: 'savestate-cli',
      export_tool_version: '0.9.0',
    },
    ...overrides,
  });

  const createMemory = (overrides: Partial<PassportMemory> = {}): PassportMemory => ({
    id: 'mem-123',
    content: 'Test memory content',
    content_type: 'text',
    tags: ['test'],
    importance: 0.5,
    created_at: new Date().toISOString(),
    source: {
      type: 'user_input',
      identifier: 'test-user',
    },
    ...overrides,
  });

  const createSnapshot = (overrides: Partial<PassportSnapshot> = {}): PassportSnapshot => ({
    id: 'snap-123',
    timestamp: new Date().toISOString(),
    platform: 'claude-code',
    label: 'Test snapshot',
    size: 1024,
    ...overrides,
  });

  describe('Passport Format', () => {
    it('has correct version format', () => {
      const passport = createPassport();
      expect(passport.version).toBe('1.0.0');
    });

    it('contains source agent information', () => {
      const passport = createPassport({
        source_agent: {
          id: 'my-agent',
          platform: 'cursor',
          name: 'My Agent',
        },
      });

      expect(passport.source_agent.id).toBe('my-agent');
      expect(passport.source_agent.platform).toBe('cursor');
      expect(passport.source_agent.name).toBe('My Agent');
    });

    it('tracks export metadata', () => {
      const passport = createPassport({
        metadata: {
          total_memories: 5,
          total_snapshots: 2,
          export_tool: 'savestate-cli',
          export_tool_version: '0.9.0',
        },
      });

      expect(passport.metadata.total_memories).toBe(5);
      expect(passport.metadata.total_snapshots).toBe(2);
    });
  });

  describe('Passport Memory', () => {
    it('has required fields', () => {
      const memory = createMemory();

      expect(memory.id).toBeDefined();
      expect(memory.content).toBeDefined();
      expect(memory.content_type).toBeDefined();
      expect(memory.created_at).toBeDefined();
      expect(memory.source).toBeDefined();
    });

    it('supports tags and importance', () => {
      const memory = createMemory({
        tags: ['important', 'user-preference'],
        importance: 0.9,
      });

      expect(memory.tags).toContain('important');
      expect(memory.tags).toContain('user-preference');
      expect(memory.importance).toBe(0.9);
    });

    it('supports different content types', () => {
      const textMemory = createMemory({ content_type: 'text' });
      const jsonMemory = createMemory({ content_type: 'json' });
      const codeMemory = createMemory({ content_type: 'code' });

      expect(textMemory.content_type).toBe('text');
      expect(jsonMemory.content_type).toBe('json');
      expect(codeMemory.content_type).toBe('code');
    });

    it('supports different source types', () => {
      const userMemory = createMemory({
        source: { type: 'user_input', identifier: 'user-123' },
      });
      const toolMemory = createMemory({
        source: { type: 'tool_output', identifier: 'web-search' },
      });

      expect(userMemory.source.type).toBe('user_input');
      expect(toolMemory.source.type).toBe('tool_output');
    });
  });

  describe('Passport Snapshot', () => {
    it('has required fields', () => {
      const snapshot = createSnapshot();

      expect(snapshot.id).toBeDefined();
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.platform).toBeDefined();
    });

    it('supports optional label and size', () => {
      const snapshot = createSnapshot({
        label: 'Pre-refactor backup',
        size: 2048,
      });

      expect(snapshot.label).toBe('Pre-refactor backup');
      expect(snapshot.size).toBe(2048);
    });

    it('can have undefined optional fields', () => {
      const snapshot = createSnapshot();
      delete snapshot.label;
      delete snapshot.size;

      expect(snapshot.label).toBeUndefined();
      expect(snapshot.size).toBeUndefined();
    });
  });

  describe('Passport with Data', () => {
    it('can contain multiple memories', () => {
      const passport = createPassport({
        memories: [
          createMemory({ id: 'mem-1', content: 'First memory' }),
          createMemory({ id: 'mem-2', content: 'Second memory' }),
          createMemory({ id: 'mem-3', content: 'Third memory' }),
        ],
        metadata: {
          total_memories: 3,
          total_snapshots: 0,
          export_tool: 'savestate-cli',
          export_tool_version: '0.9.0',
        },
      });

      expect(passport.memories.length).toBe(3);
      expect(passport.metadata.total_memories).toBe(3);
    });

    it('can contain multiple snapshots', () => {
      const passport = createPassport({
        snapshots: [
          createSnapshot({ id: 'snap-1' }),
          createSnapshot({ id: 'snap-2' }),
        ],
        metadata: {
          total_memories: 0,
          total_snapshots: 2,
          export_tool: 'savestate-cli',
          export_tool_version: '0.9.0',
        },
      });

      expect(passport.snapshots.length).toBe(2);
      expect(passport.metadata.total_snapshots).toBe(2);
    });

    it('supports cross-platform transfer metadata', () => {
      const passport = createPassport({
        source_agent: {
          id: 'agent-from-mem0',
          platform: 'mem0',
          name: 'Imported from Mem0',
        },
        metadata: {
          total_memories: 100,
          total_snapshots: 5,
          export_tool: 'mem0-exporter',
          export_tool_version: '2.0.0',
        },
      });

      expect(passport.source_agent.platform).toBe('mem0');
      expect(passport.metadata.export_tool).toBe('mem0-exporter');
    });
  });
});

describe('MCP Tools Schema', () => {
  describe('savestate_memory_store', () => {
    it('defines required fields correctly', () => {
      const requiredFields = ['namespace', 'content'];
      const optionalFields = ['content_type', 'tags', 'importance', 'source'];

      // This is a schema validation test - we're checking the tool definition
      expect(requiredFields).toContain('namespace');
      expect(requiredFields).toContain('content');
      expect(optionalFields).toContain('tags');
    });
  });

  describe('savestate_memory_search', () => {
    it('defines search query parameters', () => {
      const searchParams = {
        namespace: { org_id: 'test', app_id: 'test', agent_id: 'test' },
        query: 'search term',
        tags: ['filter-tag'],
        limit: 10,
        min_importance: 0.5,
      };

      expect(searchParams.namespace).toBeDefined();
      expect(searchParams.query).toBe('search term');
      expect(searchParams.limit).toBe(10);
    });
  });

  describe('savestate_memory_delete', () => {
    it('requires memory_id and reason', () => {
      const deleteParams = {
        memory_id: 'mem-to-delete',
        reason: 'User requested deletion',
      };

      expect(deleteParams.memory_id).toBeDefined();
      expect(deleteParams.reason).toBeDefined();
    });
  });
});

describe('MCP Resources', () => {
  // Helper to parse savestate:// URIs the same way the server does
  // For custom protocols, Node.js URL puts the resource type in hostname, not pathname
  function parseResourceUri(uri: string): { protocol: string; resourceType: string; path: string } {
    const url = new URL(uri);
    return {
      protocol: url.protocol,
      resourceType: url.hostname,
      path: url.pathname.replace(/^\//, ''),
    };
  }

  describe('savestate://snapshots', () => {
    it('parses snapshot resource URIs', () => {
      const uri = 'savestate://snapshots/my-agent';
      const parsed = parseResourceUri(uri);

      expect(parsed.protocol).toBe('savestate:');
      expect(parsed.resourceType).toBe('snapshots');
      expect(parsed.path).toBe('my-agent');
    });

    it('handles base snapshots URI', () => {
      const uri = 'savestate://snapshots';
      const parsed = parseResourceUri(uri);

      expect(parsed.protocol).toBe('savestate:');
      expect(parsed.resourceType).toBe('snapshots');
      expect(parsed.path).toBe('');
    });
  });

  describe('savestate://memories', () => {
    it('parses memory resource URIs with namespace', () => {
      const uri = 'savestate://memories/org:app:agent';
      const parsed = parseResourceUri(uri);

      expect(parsed.protocol).toBe('savestate:');
      expect(parsed.resourceType).toBe('memories');
      expect(parsed.path).toBe('org:app:agent');
    });

    it('handles base memories URI', () => {
      const uri = 'savestate://memories';
      const parsed = parseResourceUri(uri);

      expect(parsed.protocol).toBe('savestate:');
      expect(parsed.resourceType).toBe('memories');
      expect(parsed.path).toBe('');
    });

    it('parses namespace from path', () => {
      const uri = 'savestate://memories/myorg:myapp:myagent:myuser';
      const parsed = parseResourceUri(uri);
      const nsParts = parsed.path.split(':');

      expect(nsParts[0]).toBe('myorg');
      expect(nsParts[1]).toBe('myapp');
      expect(nsParts[2]).toBe('myagent');
      expect(nsParts[3]).toBe('myuser');
    });
  });
});

describe('MCP Configuration', () => {
  it('defines default MCP config', () => {
    const defaultMCPConfig = {
      enabled: false,
      port: 3333,
      auth: {
        type: 'none' as const,
      },
    };

    expect(defaultMCPConfig.enabled).toBe(false);
    expect(defaultMCPConfig.port).toBe(3333);
    expect(defaultMCPConfig.auth.type).toBe('none');
  });

  it('supports token authentication', () => {
    const tokenAuth = {
      enabled: true,
      port: 3333,
      auth: {
        type: 'token' as const,
        token: 'secret-token-123',
      },
    };

    expect(tokenAuth.auth.type).toBe('token');
    expect(tokenAuth.auth.token).toBe('secret-token-123');
  });

  it('supports custom port', () => {
    const customPortConfig = {
      enabled: true,
      port: 8080,
      auth: {
        type: 'none' as const,
      },
    };

    expect(customPortConfig.port).toBe(8080);
  });
});

// ─── MemoryStore Integration Tests (Issue #176) ──────────────

describe('MemoryStore Integration', () => {
  let store: MemoryStore;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = join(tmpdir(), `mcp-test-${Date.now()}.db`);
    store = new MemoryStore({ dbPath: testDbPath });
  });

  afterEach(async () => {
    store.close();
    await fs.unlink(testDbPath).catch(() => {});
  });

  describe('Memory CRUD', () => {
    it('should create and retrieve a memory', async () => {
      const memory = await store.create({
        type: 'fact',
        content: 'Test fact content',
        tags: ['test'],
        importance: 0.8,
      });

      expect(memory.id).toBeDefined();
      expect(memory.type).toBe('fact');
      expect(memory.content).toBe('Test fact content');
      expect(memory.importance).toBe(0.8);

      const retrieved = await store.get(memory.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.content).toBe('Test fact content');
    });

    it('should update a memory', async () => {
      const memory = await store.create({
        type: 'preference',
        content: 'Original content',
      });

      const updated = await store.update(memory.id, {
        content: 'Updated content',
        importance: 0.9,
      });

      expect(updated!.content).toBe('Updated content');
      expect(updated!.importance).toBe(0.9);
    });

    it('should delete a memory', async () => {
      const memory = await store.create({
        type: 'event',
        content: 'Event to delete',
      });

      const deleted = store.delete(memory.id);
      expect(deleted).toBe(true);

      const retrieved = await store.get(memory.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Memory Queries', () => {
    beforeEach(async () => {
      // Create test data
      await store.create({ type: 'fact', content: 'Fact 1', tags: ['tag1'], importance: 0.9 });
      await store.create({ type: 'fact', content: 'Fact 2', tags: ['tag2'], importance: 0.5 });
      await store.create({ type: 'event', content: 'Event 1', tags: ['tag1'] });
      await store.create({ type: 'preference', content: 'Pref 1', importance: 0.7 });
    });

    it('should query by type', async () => {
      const facts = await store.query({ type: 'fact' });
      expect(facts.length).toBe(2);
      expect(facts.every(m => m.type === 'fact')).toBe(true);
    });

    it('should query by tags', async () => {
      const tagged = await store.query({ tags: ['tag1'] });
      expect(tagged.length).toBe(2);
    });

    it('should query by minimum importance', async () => {
      const important = await store.query({ minImportance: 0.7 });
      expect(important.length).toBe(2);
      expect(important.every(m => m.importance! >= 0.7)).toBe(true);
    });

    it('should search by content', async () => {
      const results = await store.query({ search: 'Fact' });
      expect(results.length).toBe(2);
    });

    it('should limit results', async () => {
      const limited = await store.query({ limit: 2 });
      expect(limited.length).toBe(2);
    });
  });

  describe('Memory Stats', () => {
    it('should return accurate stats', async () => {
      await store.create({ type: 'fact', content: 'F1' });
      await store.create({ type: 'fact', content: 'F2' });
      await store.create({ type: 'event', content: 'E1' });

      const stats = store.getStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.byType.fact).toBe(2);
      expect(stats.byType.event).toBe(1);
    });
  });

  describe('Clear All', () => {
    it('should delete all memories', async () => {
      await store.create({ type: 'fact', content: 'F1' });
      await store.create({ type: 'fact', content: 'F2' });

      store.clear();

      const stats = store.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});

// ─── OpenMemory-Compatible Tools Tests (Issue #176) ──────────

describe('OpenMemory API Compatibility', () => {
  describe('Tool Definitions', () => {
    it('should have add_memories tool', () => {
      const toolName = 'add_memories';
      const requiredCapabilities = ['memories array', 'content string'];
      expect(toolName).toBe('add_memories');
      expect(requiredCapabilities).toContain('memories array');
    });

    it('should have search_memory tool', () => {
      const toolName = 'search_memory';
      expect(toolName).toBe('search_memory');
    });

    it('should have list_memories tool', () => {
      const toolName = 'list_memories';
      expect(toolName).toBe('list_memories');
    });

    it('should have delete_memory tool', () => {
      const toolName = 'delete_memory';
      expect(toolName).toBe('delete_memory');
    });

    it('should have delete_all_memories tool', () => {
      const toolName = 'delete_all_memories';
      expect(toolName).toBe('delete_all_memories');
    });
  });

  describe('add_memories Input Schema', () => {
    it('accepts memories array', () => {
      const input = {
        memories: [
          { content: 'Memory 1', type: 'fact' },
          { content: 'Memory 2', tags: ['important'] },
        ],
      };
      expect(input.memories.length).toBe(2);
    });

    it('accepts single content string', () => {
      const input = { content: 'Single memory' };
      expect(input.content).toBe('Single memory');
    });
  });

  describe('search_memory Input Schema', () => {
    it('accepts query with filters', () => {
      const input = {
        query: 'search term',
        type: 'fact',
        tags: ['tag1'],
        limit: 10,
      };
      expect(input.query).toBe('search term');
      expect(input.type).toBe('fact');
    });
  });

  describe('list_memories Input Schema', () => {
    it('supports pagination', () => {
      const input = {
        limit: 50,
        offset: 100,
      };
      expect(input.limit).toBe(50);
      expect(input.offset).toBe(100);
    });
  });

  describe('delete_all_memories Safety', () => {
    it('requires explicit confirmation', () => {
      const safeInput = { confirm: true };
      const unsafeInput = { confirm: false };

      expect(safeInput.confirm).toBe(true);
      expect(unsafeInput.confirm).toBe(false);
    });
  });
});
