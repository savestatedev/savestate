#!/usr/bin/env node
/**
 * SaveState MCP Server
 *
 * Exposes SaveState functionality as MCP tools for cross-platform interoperability.
 * Compatible with Claude Desktop, Cursor, and other MCP-compatible clients.
 *
 * Issue #107: MCP-native memory interface
 *
 * Tools:
 * - savestate_snapshot: Create a new snapshot of agent state
 * - savestate_restore: Restore from a specific snapshot
 * - savestate_list: List available snapshots for an agent
 * - savestate_status: Check SaveState initialization status
 * - savestate_memory_store: Store a memory entry
 * - savestate_memory_search: Search memories
 * - savestate_memory_delete: Delete a memory
 *
 * Resources:
 * - savestate://snapshots/{agent_id} - List of snapshots
 * - savestate://memories/{namespace} - Memories in a namespace
 *
 * Usage in Claude Code:
 *   Add to ~/.claude/settings.json:
 *   {
 *     "mcpServers": {
 *       "savestate": {
 *         "command": "npx",
 *         "args": ["@savestate/cli", "mcp"]
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type Tool,
  type Resource,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { isInitialized, loadConfig } from '../config.js';
import { detectAdapter, getAdapter } from '../adapters/registry.js';
import { createSnapshot } from '../snapshot.js';
import { restoreSnapshot } from '../restore.js';
import { resolveStorage } from '../storage/resolve.js';
import { loadIndex, type SnapshotIndexEntry } from '../index-file.js';
import { KnowledgeLane } from '../checkpoint/memory.js';
import { InMemoryCheckpointStorage } from '../checkpoint/storage/index.js';
import type { Namespace } from '../checkpoint/types.js';
import type { MemoryEntry } from '../types.js';

// ─── Shared Storage Instance ─────────────────────────────────

let checkpointStorage: InMemoryCheckpointStorage | null = null;
let knowledgeLane: KnowledgeLane | null = null;

function getCheckpointStorage(): InMemoryCheckpointStorage {
  if (!checkpointStorage) {
    checkpointStorage = new InMemoryCheckpointStorage();
  }
  return checkpointStorage;
}

function getKnowledgeLane(): KnowledgeLane {
  if (!knowledgeLane) {
    knowledgeLane = new KnowledgeLane(getCheckpointStorage());
  }
  return knowledgeLane;
}

// ─── Tool Definitions ────────────────────────────────────────

const tools: Tool[] = [
  {
    name: 'savestate_snapshot',
    description:
      'Create a new encrypted snapshot of the current AI agent state. ' +
      'Captures CLAUDE.md files, memory, settings, and project structure. ' +
      'Returns snapshot ID and stats.',
    inputSchema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Optional human-readable label for this snapshot',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for organizing snapshots',
        },
        adapter: {
          type: 'string',
          description:
            'Adapter to use (claude-code, clawdbot, etc.). Auto-detected if not specified.',
        },
        full: {
          type: 'boolean',
          description: 'Force a full snapshot instead of incremental',
        },
        passphrase: {
          type: 'string',
          description: 'Encryption passphrase. Required for snapshot creation.',
        },
      },
      required: ['passphrase'],
    },
  },
  {
    name: 'savestate_restore',
    description:
      'Restore AI agent state from a snapshot. ' +
      'Use "latest" as snapshotId to restore the most recent snapshot. ' +
      'Returns details about what was restored.',
    inputSchema: {
      type: 'object',
      properties: {
        snapshotId: {
          type: 'string',
          description: 'Snapshot ID to restore, or "latest" for most recent',
        },
        adapter: {
          type: 'string',
          description: 'Adapter to use for restore. Auto-detected if not specified.',
        },
        dryRun: {
          type: 'boolean',
          description: 'Preview what would be restored without making changes',
        },
        passphrase: {
          type: 'string',
          description: 'Decryption passphrase. Required for restore.',
        },
      },
      required: ['snapshotId', 'passphrase'],
    },
  },
  {
    name: 'savestate_list',
    description:
      'List available snapshots with their metadata. ' +
      'Shows ID, timestamp, platform, label, and size.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of snapshots to return (default: 10)',
        },
        platform: {
          type: 'string',
          description: 'Filter by platform (claude-code, clawdbot, etc.)',
        },
      },
    },
  },
  {
    name: 'savestate_status',
    description:
      'Check SaveState initialization status and detected adapter. ' +
      'Returns whether SaveState is configured and which adapter would be used.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  // ─── Memory Tools (Issue #107) ─────────────────────────────
  {
    name: 'savestate_memory_store',
    description:
      'Store a new memory entry in the SaveState memory system. ' +
      'Memories are indexed for semantic search and can be retrieved later.',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: {
          type: 'object',
          description: 'Namespace for memory isolation',
          properties: {
            org_id: { type: 'string', description: 'Organization ID' },
            app_id: { type: 'string', description: 'Application ID' },
            agent_id: { type: 'string', description: 'Agent ID' },
            user_id: { type: 'string', description: 'User ID (optional)' },
          },
          required: ['org_id', 'app_id', 'agent_id'],
        },
        content: {
          type: 'string',
          description: 'Memory content to store',
        },
        content_type: {
          type: 'string',
          description: 'Content type (text, json, code, etc.). Defaults to "text"',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for filtering and organization',
        },
        importance: {
          type: 'number',
          description: 'Importance score (0-1). Defaults to 0.5',
        },
        source: {
          type: 'string',
          description: 'Source identifier (e.g., "user", "tool", "agent")',
        },
      },
      required: ['namespace', 'content'],
    },
  },
  {
    name: 'savestate_memory_search',
    description:
      'Search memories using semantic query and filters. ' +
      'Returns ranked results with relevance scores.',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: {
          type: 'object',
          description: 'Namespace to search within',
          properties: {
            org_id: { type: 'string', description: 'Organization ID' },
            app_id: { type: 'string', description: 'Application ID' },
            agent_id: { type: 'string', description: 'Agent ID' },
            user_id: { type: 'string', description: 'User ID (optional)' },
          },
          required: ['org_id', 'app_id', 'agent_id'],
        },
        query: {
          type: 'string',
          description: 'Semantic search query',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags (AND logic)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
        },
        min_importance: {
          type: 'number',
          description: 'Minimum importance score filter (0-1)',
        },
      },
      required: ['namespace'],
    },
  },
  {
    name: 'savestate_memory_delete',
    description:
      'Delete a memory by ID. Performs a soft delete with audit trail.',
    inputSchema: {
      type: 'object',
      properties: {
        memory_id: {
          type: 'string',
          description: 'ID of the memory to delete',
        },
        reason: {
          type: 'string',
          description: 'Reason for deletion (for audit trail)',
        },
      },
      required: ['memory_id', 'reason'],
    },
  },
];

// ─── Resource Definitions ────────────────────────────────────

const resources: Resource[] = [
  {
    uri: 'savestate://snapshots',
    name: 'Snapshots',
    description: 'List of all available snapshots',
    mimeType: 'application/json',
  },
  {
    uri: 'savestate://memories',
    name: 'Memories',
    description: 'Memory entries in the default namespace',
    mimeType: 'application/json',
  },
];

// ─── Tool Input Schemas (Zod) ────────────────────────────────

const SnapshotInputSchema = z.object({
  label: z.string().optional(),
  tags: z.array(z.string()).optional(),
  adapter: z.string().optional(),
  full: z.boolean().optional(),
  passphrase: z.string(),
});

const RestoreInputSchema = z.object({
  snapshotId: z.string(),
  adapter: z.string().optional(),
  dryRun: z.boolean().optional(),
  passphrase: z.string(),
});

const ListInputSchema = z.object({
  limit: z.number().optional(),
  platform: z.string().optional(),
});

const NamespaceSchema = z.object({
  org_id: z.string(),
  app_id: z.string(),
  agent_id: z.string(),
  user_id: z.string().optional(),
});

const MemoryStoreInputSchema = z.object({
  namespace: NamespaceSchema,
  content: z.string(),
  content_type: z.string().optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().min(0).max(1).optional(),
  source: z.string().optional(),
});

const MemorySearchInputSchema = z.object({
  namespace: NamespaceSchema,
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().optional(),
  min_importance: z.number().optional(),
});

const MemoryDeleteInputSchema = z.object({
  memory_id: z.string(),
  reason: z.string(),
});

// ─── Tool Handlers ───────────────────────────────────────────

async function handleSnapshot(
  input: z.infer<typeof SnapshotInputSchema>,
): Promise<string> {
  if (!isInitialized()) {
    return 'Error: SaveState not initialized. Run `savestate init` first.';
  }

  const config = await loadConfig();

  // Resolve adapter
  let adapter;
  if (input.adapter) {
    adapter = getAdapter(input.adapter);
    if (!adapter) {
      return `Error: Unknown adapter: ${input.adapter}`;
    }
  } else if (config.defaultAdapter) {
    adapter = getAdapter(config.defaultAdapter);
  } else {
    adapter = await detectAdapter();
  }

  if (!adapter) {
    return 'Error: No adapter detected. Specify one with the adapter parameter.';
  }

  const storage = resolveStorage(config);

  try {
    const result = await createSnapshot(adapter, storage, input.passphrase, {
      label: input.label,
      tags: input.tags,
      full: input.full,
    });

    const lines = [
      `Snapshot created successfully!`,
      ``,
      `ID: ${result.snapshot.manifest.id}`,
      `Adapter: ${adapter.name}`,
      `Type: ${result.incremental ? 'incremental' : 'full'}`,
    ];

    if (input.label) {
      lines.push(`Label: ${input.label}`);
    }

    if (result.incremental && result.delta) {
      lines.push(
        `Changes: +${result.delta.added} added, ~${result.delta.modified} modified, -${result.delta.removed} removed`,
      );
      lines.push(`Chain depth: ${result.delta.chainDepth}`);
    }

    lines.push(`Files: ${result.fileCount}`);
    lines.push(`Archive size: ${formatBytes(result.archiveSize)}`);
    lines.push(`Encrypted size: ${formatBytes(result.encryptedSize)}`);
    lines.push(`Storage: ${config.storage.type}`);

    return lines.join('\n');
  } catch (err) {
    return `Error creating snapshot: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function handleRestore(
  input: z.infer<typeof RestoreInputSchema>,
): Promise<string> {
  if (!isInitialized()) {
    return 'Error: SaveState not initialized. Run `savestate init` first.';
  }

  const config = await loadConfig();

  // Resolve adapter
  let adapter;
  if (input.adapter) {
    adapter = getAdapter(input.adapter);
    if (!adapter) {
      return `Error: Unknown adapter: ${input.adapter}`;
    }
  } else if (config.defaultAdapter) {
    adapter = getAdapter(config.defaultAdapter);
  } else {
    adapter = await detectAdapter();
  }

  if (!adapter) {
    return 'Error: No adapter detected. Specify one with the adapter parameter.';
  }

  const storage = resolveStorage(config);

  try {
    const result = await restoreSnapshot(
      input.snapshotId,
      adapter,
      storage,
      input.passphrase,
      { dryRun: input.dryRun },
    );

    const lines = [
      input.dryRun ? 'Dry run complete (no changes made)' : 'Restore complete!',
      ``,
      `Snapshot: ${result.snapshotId}`,
      `Timestamp: ${result.timestamp}`,
      `Platform: ${result.platform}`,
      `Adapter: ${result.adapter}`,
    ];

    if (result.label) {
      lines.push(`Label: ${result.label}`);
    }

    lines.push(`Identity: ${result.hasIdentity ? 'restored' : 'none'}`);
    lines.push(`Memory entries: ${result.memoryCount}`);
    lines.push(`Conversations: ${result.conversationCount}`);

    return lines.join('\n');
  } catch (err) {
    return `Error restoring snapshot: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function handleList(
  input: z.infer<typeof ListInputSchema>,
): Promise<string> {
  if (!isInitialized()) {
    return 'Error: SaveState not initialized. Run `savestate init` first.';
  }

  try {
    const index = await loadIndex();
    let entries: SnapshotIndexEntry[] = index.snapshots;

    // Filter by platform if specified
    if (input.platform) {
      entries = entries.filter((e: SnapshotIndexEntry) => e.platform === input.platform);
    }

    // Sort by timestamp (newest first)
    entries.sort((a: SnapshotIndexEntry, b: SnapshotIndexEntry) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Limit results
    const limit = input.limit ?? 10;
    entries = entries.slice(0, limit);

    if (entries.length === 0) {
      return 'No snapshots found.';
    }

    const lines = [`Found ${entries.length} snapshot(s):`, ``];

    for (const entry of entries) {
      const date = new Date(entry.timestamp).toLocaleString();
      const labelPart = entry.label ? ` "${entry.label}"` : '';
      const sizePart = entry.size ? ` (${formatBytes(entry.size)})` : '';
      lines.push(`- ${entry.id}${labelPart}`);
      lines.push(`  ${date} | ${entry.platform}${sizePart}`);
    }

    return lines.join('\n');
  } catch (err) {
    return `Error listing snapshots: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function handleStatus(): Promise<string> {
  const initialized = isInitialized();

  if (!initialized) {
    return [
      'SaveState Status: Not initialized',
      '',
      'Run `savestate init` to set up SaveState in this directory.',
    ].join('\n');
  }

  const config = await loadConfig();
  const adapter = await detectAdapter();

  const lines = [
    'SaveState Status: Initialized',
    '',
    `Storage: ${config.storage.type}`,
    `Default adapter: ${config.defaultAdapter ?? 'auto-detect'}`,
    `Detected adapter: ${adapter ? adapter.name : 'none'}`,
  ];

  if (adapter) {
    lines.push(`Adapter version: ${adapter.version}`);
  }

  // MCP config status
  if (config.mcp) {
    lines.push('');
    lines.push('MCP Configuration:');
    lines.push(`  Enabled: ${config.mcp.enabled}`);
    lines.push(`  Port: ${config.mcp.port}`);
    lines.push(`  Auth: ${config.mcp.auth.type}`);
  }

  return lines.join('\n');
}

// ─── Memory Tool Handlers (Issue #107) ───────────────────────

async function handleMemoryStore(
  input: z.infer<typeof MemoryStoreInputSchema>,
): Promise<string> {
  try {
    const lane = getKnowledgeLane();

    const memory = await lane.storeMemory({
      namespace: input.namespace as Namespace,
      content: input.content,
      content_type: input.content_type ?? 'text',
      source: {
        type: (input.source as 'user_input' | 'tool_output' | 'agent_inference' | 'external' | 'system') ?? 'external',
        identifier: input.source ?? 'mcp',
      },
      tags: input.tags,
      importance: input.importance,
    });

    const lines = [
      'Memory stored successfully!',
      '',
      `ID: ${memory.memory_id}`,
      `Content type: ${memory.content_type}`,
      `Tags: ${memory.tags.length > 0 ? memory.tags.join(', ') : 'none'}`,
      `Importance: ${memory.importance}`,
      `Created: ${memory.created_at}`,
    ];

    return lines.join('\n');
  } catch (err) {
    return `Error storing memory: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function handleMemorySearch(
  input: z.infer<typeof MemorySearchInputSchema>,
): Promise<string> {
  try {
    const lane = getKnowledgeLane();

    const results = await lane.searchMemories({
      namespace: input.namespace as Namespace,
      query: input.query,
      tags: input.tags,
      limit: input.limit ?? 10,
      min_importance: input.min_importance,
      include_content: true,
    });

    if (results.length === 0) {
      return 'No memories found matching your query.';
    }

    const lines = [`Found ${results.length} memory(ies):`, ''];

    for (const result of results) {
      lines.push(`- ${result.memory_id}`);
      lines.push(`  Score: ${result.score.toFixed(3)}`);
      lines.push(`  Tags: ${result.tags.length > 0 ? result.tags.join(', ') : 'none'}`);
      if (result.content) {
        const preview = result.content.length > 100
          ? result.content.slice(0, 100) + '...'
          : result.content;
        lines.push(`  Content: ${preview}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  } catch (err) {
    return `Error searching memories: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function handleMemoryDelete(
  input: z.infer<typeof MemoryDeleteInputSchema>,
): Promise<string> {
  try {
    const lane = getKnowledgeLane();

    await lane.deleteMemory(input.memory_id, 'mcp-client', input.reason);

    return [
      'Memory deleted successfully!',
      '',
      `ID: ${input.memory_id}`,
      `Reason: ${input.reason}`,
    ].join('\n');
  } catch (err) {
    return `Error deleting memory: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Resource Handlers ───────────────────────────────────────

async function handleReadResource(uri: string): Promise<string> {
  const url = new URL(uri);

  if (url.protocol !== 'savestate:') {
    throw new Error(`Unknown protocol: ${url.protocol}`);
  }

  // For custom protocols, Node.js URL puts the resource type in hostname
  const resourceType = url.hostname;
  const pathParts = url.pathname.replace(/^\//, '').split('/').filter(Boolean);

  switch (resourceType) {
    case 'snapshots': {
      if (!isInitialized()) {
        return JSON.stringify({ error: 'SaveState not initialized' });
      }

      const agentId = pathParts[0];
      const index = await loadIndex();
      let entries = index.snapshots;

      if (agentId) {
        entries = entries.filter((e: SnapshotIndexEntry) =>
          e.platform === agentId || e.id.includes(agentId)
        );
      }

      entries.sort((a: SnapshotIndexEntry, b: SnapshotIndexEntry) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return JSON.stringify({
        count: entries.length,
        snapshots: entries.map((e: SnapshotIndexEntry) => ({
          id: e.id,
          timestamp: e.timestamp,
          platform: e.platform,
          label: e.label,
          size: e.size,
        })),
      }, null, 2);
    }

    case 'memories': {
      const namespaceStr = pathParts[0];
      let namespace: Namespace;

      if (namespaceStr) {
        const nsParts = namespaceStr.split(':');
        namespace = {
          org_id: nsParts[0] ?? 'default',
          app_id: nsParts[1] ?? 'default',
          agent_id: nsParts[2] ?? 'default',
          user_id: nsParts[3],
        };
      } else {
        namespace = {
          org_id: 'default',
          app_id: 'default',
          agent_id: 'default',
        };
      }

      const lane = getKnowledgeLane();
      const memories = await lane.listMemories(namespace, { limit: 100 });

      return JSON.stringify({
        count: memories.length,
        namespace: namespace,
        memories: memories.map(m => ({
          id: m.memory_id,
          content: m.content,
          tags: m.tags,
          importance: m.importance,
          created_at: m.created_at,
          status: m.status,
        })),
      }, null, 2);
    }

    default:
      throw new Error(`Unknown resource type: ${resourceType}`);
  }
}

// ─── Utilities ───────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Server Setup ────────────────────────────────────────────

export async function startMCPServer(): Promise<void> {
  const server = new Server(
    {
      name: 'savestate',
      version: '0.9.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Handle resource listing
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources };
  });

  // Handle resource reading
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
      const content = await handleReadResource(uri);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: content,
          },
        ],
      };
    } catch (err) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err)
            }),
          },
        ],
      };
    }
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'savestate_snapshot': {
          const input = SnapshotInputSchema.parse(args);
          result = await handleSnapshot(input);
          break;
        }
        case 'savestate_restore': {
          const input = RestoreInputSchema.parse(args);
          result = await handleRestore(input);
          break;
        }
        case 'savestate_list': {
          const input = ListInputSchema.parse(args);
          result = await handleList(input);
          break;
        }
        case 'savestate_status': {
          result = await handleStatus();
          break;
        }
        case 'savestate_memory_store': {
          const input = MemoryStoreInputSchema.parse(args);
          result = await handleMemoryStore(input);
          break;
        }
        case 'savestate_memory_search': {
          const input = MemorySearchInputSchema.parse(args);
          result = await handleMemorySearch(input);
          break;
        }
        case 'savestate_memory_delete': {
          const input = MemoryDeleteInputSchema.parse(args);
          result = await handleMemoryDelete(input);
          break;
        }
        default:
          result = `Unknown tool: ${name}`;
      }

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is for MCP protocol)
  console.error('SaveState MCP server running on stdio');
}

// Run when executed directly
startMCPServer().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
