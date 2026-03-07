#!/usr/bin/env node
/**
 * SaveState MCP Server
 *
 * Exposes SaveState functionality as MCP tools for cross-platform interoperability.
 * Compatible with Claude Desktop, Cursor, and other MCP-compatible clients.
 *
 * Issues: #107, #176
 *
 * SaveState Tools:
 * - savestate_snapshot: Create a new snapshot of agent state
 * - savestate_restore: Restore from a specific snapshot
 * - savestate_list: List available snapshots for an agent
 * - savestate_status: Check SaveState initialization status
 * - savestate_memory_store: Store a memory entry
 * - savestate_memory_search: Search memories
 * - savestate_memory_delete: Delete a memory
 *
 * OpenMemory-Compatible Tools (Issue #176):
 * - add_memories: Store memory entries (OpenMemory API)
 * - search_memory: Search memories (OpenMemory API)
 * - list_memories: List all memories (OpenMemory API)
 * - delete_memory: Delete a memory (OpenMemory API)
 * - delete_all_memories: Clear all memories (OpenMemory API)
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
import { MemoryStore } from '../memory/store.js';
import type { MemoryEntry, MemoryType, MemoryQuery } from '../memory/types.js';

// ─── Shared Memory Store Instance ────────────────────────────

let memoryStore: MemoryStore | null = null;

function getMemoryStore(): MemoryStore {
  if (!memoryStore) {
    // Initialize with default settings (no encryption by default for MCP)
    // Users can configure encryption via environment variables
    const passphrase = process.env.SAVESTATE_MCP_PASSPHRASE;
    memoryStore = new MemoryStore({
      keySource: passphrase ? { passphrase } : undefined,
      encryptionEnabled: !!passphrase,
    });
  }
  return memoryStore;
}

// ─── Tool Definitions ────────────────────────────────────────

const tools: Tool[] = [
  // ─── SaveState Core Tools ──────────────────────────────────
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
  // ─── SaveState Memory Tools ────────────────────────────────
  {
    name: 'savestate_memory_store',
    description:
      'Store a new memory entry in the SaveState memory system. ' +
      'Memories are persisted to SQLite and can be retrieved later.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Memory content to store',
        },
        type: {
          type: 'string',
          enum: ['fact', 'event', 'preference', 'conversation'],
          description: 'Memory type. Defaults to "fact"',
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
        metadata: {
          type: 'object',
          description: 'Additional metadata to store with the memory',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'savestate_memory_search',
    description:
      'Search memories using text query and filters. ' +
      'Returns matching memories with their metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text search query',
        },
        type: {
          type: 'string',
          enum: ['fact', 'event', 'preference', 'conversation'],
          description: 'Filter by memory type',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
        },
        minImportance: {
          type: 'number',
          description: 'Minimum importance score filter (0-1)',
        },
      },
    },
  },
  {
    name: 'savestate_memory_delete',
    description: 'Delete a memory by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the memory to delete',
        },
      },
      required: ['id'],
    },
  },
  // ─── OpenMemory-Compatible Tools (Issue #176) ──────────────
  {
    name: 'add_memories',
    description:
      'Store new memory entries. Compatible with OpenMemory MCP API. ' +
      'Use this to persist facts, preferences, events, or conversation context.',
    inputSchema: {
      type: 'object',
      properties: {
        memories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'Memory content' },
              type: {
                type: 'string',
                enum: ['fact', 'event', 'preference', 'conversation'],
                description: 'Memory type',
              },
              tags: { type: 'array', items: { type: 'string' } },
              importance: { type: 'number' },
              metadata: { type: 'object' },
            },
            required: ['content'],
          },
          description: 'Array of memories to store',
        },
        content: {
          type: 'string',
          description: 'Single memory content (alternative to memories array)',
        },
      },
    },
  },
  {
    name: 'search_memory',
    description:
      'Search stored memories. Compatible with OpenMemory MCP API. ' +
      'Returns relevant memories based on query and filters.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query text',
        },
        type: {
          type: 'string',
          enum: ['fact', 'event', 'preference', 'conversation'],
          description: 'Filter by memory type',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 10)',
        },
      },
    },
  },
  {
    name: 'list_memories',
    description:
      'List all stored memories. Compatible with OpenMemory MCP API. ' +
      'Returns memories with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['fact', 'event', 'preference', 'conversation'],
          description: 'Filter by memory type',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 50)',
        },
        offset: {
          type: 'number',
          description: 'Pagination offset',
        },
      },
    },
  },
  {
    name: 'delete_memory',
    description: 'Delete a specific memory by ID. Compatible with OpenMemory MCP API.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Memory ID to delete',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_all_memories',
    description:
      'Delete all stored memories. Compatible with OpenMemory MCP API. ' +
      'USE WITH CAUTION: This action is irreversible.',
    inputSchema: {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion',
        },
      },
      required: ['confirm'],
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
    description: 'Memory entries',
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

const MemoryStoreInputSchema = z.object({
  content: z.string(),
  type: z.enum(['fact', 'event', 'preference', 'conversation']).optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const MemorySearchInputSchema = z.object({
  query: z.string().optional(),
  type: z.enum(['fact', 'event', 'preference', 'conversation']).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().optional(),
  minImportance: z.number().optional(),
});

const MemoryDeleteInputSchema = z.object({
  id: z.string(),
});

// OpenMemory-compatible schemas
const AddMemoriesInputSchema = z.object({
  memories: z.array(z.object({
    content: z.string(),
    type: z.enum(['fact', 'event', 'preference', 'conversation']).optional(),
    tags: z.array(z.string()).optional(),
    importance: z.number().min(0).max(1).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })).optional(),
  content: z.string().optional(),
});

const ListMemoriesInputSchema = z.object({
  type: z.enum(['fact', 'event', 'preference', 'conversation']).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

const DeleteAllMemoriesInputSchema = z.object({
  confirm: z.boolean(),
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

  // Memory store status
  const store = getMemoryStore();
  const stats = store.getStats();
  lines.push('');
  lines.push('Memory Store:');
  lines.push(`  Total entries: ${stats.totalEntries}`);
  lines.push(`  Facts: ${stats.byType.fact}`);
  lines.push(`  Events: ${stats.byType.event}`);
  lines.push(`  Preferences: ${stats.byType.preference}`);
  lines.push(`  Conversations: ${stats.byType.conversation}`);

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

// ─── Memory Tool Handlers ────────────────────────────────────

async function handleMemoryStore(
  input: z.infer<typeof MemoryStoreInputSchema>,
): Promise<string> {
  try {
    const store = getMemoryStore();

    const memory = await store.create({
      type: input.type ?? 'fact',
      content: input.content,
      tags: input.tags,
      importance: input.importance,
      metadata: input.metadata,
    });

    const lines = [
      'Memory stored successfully!',
      '',
      `ID: ${memory.id}`,
      `Type: ${memory.type}`,
      `Tags: ${memory.tags?.join(', ') ?? 'none'}`,
      `Importance: ${memory.importance}`,
      `Created: ${memory.createdAt}`,
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
    const store = getMemoryStore();

    const query: MemoryQuery = {
      type: input.type,
      tags: input.tags,
      search: input.query,
      limit: input.limit ?? 10,
      minImportance: input.minImportance,
    };

    const results = await store.query(query);

    if (results.length === 0) {
      return 'No memories found matching your query.';
    }

    const lines = [`Found ${results.length} memory(ies):`, ''];

    for (const memory of results) {
      lines.push(`- ${memory.id}`);
      lines.push(`  Type: ${memory.type}`);
      lines.push(`  Tags: ${memory.tags?.join(', ') ?? 'none'}`);
      lines.push(`  Importance: ${memory.importance}`);
      const preview = memory.content.length > 100
        ? memory.content.slice(0, 100) + '...'
        : memory.content;
      lines.push(`  Content: ${preview}`);
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
    const store = getMemoryStore();
    const deleted = store.delete(input.id);

    if (!deleted) {
      return `Memory not found: ${input.id}`;
    }

    return [
      'Memory deleted successfully!',
      '',
      `ID: ${input.id}`,
    ].join('\n');
  } catch (err) {
    return `Error deleting memory: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── OpenMemory-Compatible Handlers (Issue #176) ─────────────

async function handleAddMemories(
  input: z.infer<typeof AddMemoriesInputSchema>,
): Promise<string> {
  try {
    const store = getMemoryStore();
    const created: MemoryEntry[] = [];

    // Handle array of memories
    if (input.memories && input.memories.length > 0) {
      for (const mem of input.memories) {
        const entry = await store.create({
          type: mem.type ?? 'fact',
          content: mem.content,
          tags: mem.tags,
          importance: mem.importance,
          metadata: mem.metadata,
        });
        created.push(entry);
      }
    }

    // Handle single content string
    if (input.content) {
      const entry = await store.create({
        type: 'fact',
        content: input.content,
      });
      created.push(entry);
    }

    if (created.length === 0) {
      return 'No memories provided. Use "memories" array or "content" string.';
    }

    const lines = [
      `Added ${created.length} memory(ies) successfully!`,
      '',
    ];

    for (const memory of created) {
      lines.push(`- ${memory.id} (${memory.type})`);
    }

    return lines.join('\n');
  } catch (err) {
    return `Error adding memories: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function handleSearchMemory(
  input: z.infer<typeof MemorySearchInputSchema>,
): Promise<string> {
  // Reuse the SaveState handler
  return handleMemorySearch(input);
}

async function handleListMemories(
  input: z.infer<typeof ListMemoriesInputSchema>,
): Promise<string> {
  try {
    const store = getMemoryStore();

    const query: MemoryQuery = {
      type: input.type,
      tags: input.tags,
      limit: input.limit ?? 50,
      offset: input.offset,
    };

    const results = await store.query(query);
    const stats = store.getStats();

    if (results.length === 0) {
      return `No memories found. Total stored: ${stats.totalEntries}`;
    }

    const lines = [
      `Memories (${results.length} of ${stats.totalEntries} total):`,
      '',
    ];

    for (const memory of results) {
      const preview = memory.content.length > 80
        ? memory.content.slice(0, 80) + '...'
        : memory.content;
      lines.push(`- [${memory.type}] ${memory.id}`);
      lines.push(`  ${preview}`);
      if (memory.tags && memory.tags.length > 0) {
        lines.push(`  Tags: ${memory.tags.join(', ')}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  } catch (err) {
    return `Error listing memories: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function handleDeleteMemory(
  input: z.infer<typeof MemoryDeleteInputSchema>,
): Promise<string> {
  // Reuse the SaveState handler
  return handleMemoryDelete(input);
}

async function handleDeleteAllMemories(
  input: z.infer<typeof DeleteAllMemoriesInputSchema>,
): Promise<string> {
  if (!input.confirm) {
    return 'Error: Must set confirm=true to delete all memories.';
  }

  try {
    const store = getMemoryStore();
    const stats = store.getStats();
    const count = stats.totalEntries;

    store.clear();

    return [
      'All memories deleted.',
      '',
      `Deleted: ${count} memory(ies)`,
    ].join('\n');
  } catch (err) {
    return `Error deleting memories: ${err instanceof Error ? err.message : String(err)}`;
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

  switch (resourceType) {
    case 'snapshots': {
      if (!isInitialized()) {
        return JSON.stringify({ error: 'SaveState not initialized' });
      }

      const index = await loadIndex();
      const entries = index.snapshots;

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
      const store = getMemoryStore();
      const memories = await store.query({ limit: 100 });
      const stats = store.getStats();

      return JSON.stringify({
        count: memories.length,
        total: stats.totalEntries,
        byType: stats.byType,
        memories: memories.map(m => ({
          id: m.id,
          type: m.type,
          content: m.content,
          tags: m.tags,
          importance: m.importance,
          createdAt: m.createdAt,
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
        // SaveState Core Tools
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
        // SaveState Memory Tools
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
        // OpenMemory-Compatible Tools
        case 'add_memories': {
          const input = AddMemoriesInputSchema.parse(args);
          result = await handleAddMemories(input);
          break;
        }
        case 'search_memory': {
          const input = MemorySearchInputSchema.parse(args);
          result = await handleSearchMemory(input);
          break;
        }
        case 'list_memories': {
          const input = ListMemoriesInputSchema.parse(args);
          result = await handleListMemories(input);
          break;
        }
        case 'delete_memory': {
          const input = MemoryDeleteInputSchema.parse(args);
          result = await handleDeleteMemory(input);
          break;
        }
        case 'delete_all_memories': {
          const input = DeleteAllMemoriesInputSchema.parse(args);
          result = await handleDeleteAllMemories(input);
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
