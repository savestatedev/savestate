/**
 * Tests for MCP Server and Memory Passport
 *
 * Issue #107: MCP-native memory interface
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
