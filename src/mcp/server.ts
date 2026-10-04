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
import { parseAddMemoriesLimit, selectAddMemoriesEntries } from './add-memories-limit.js';
import { parseDeleteAllMemoriesLimit, selectDeleteAllMemoriesEntries } from './delete-all-memories-limit.js';
import { parseDeleteMemoryLimit, selectDeleteMemoryEntries } from './delete-memory-limit.js';
import { parseListMemoriesLimit, selectListMemoriesEntries } from './list-memories-limit.js';
import { parseListMemoriesOffset } from './list-memories-offset.js';
import { parseSavestateListLimit, selectSavestateListEntries } from './savestate-list-limit.js';
import { parseSavestateListOffset, selectSavestateListOffsetEntries } from './savestate-list-offset.js';
import { parseSavestateMemoryDeleteLimit, selectSavestateMemoryDeleteEntries } from './savestate-memory-delete-limit.js';
import {
  parseSavestateMemorySearchLimit,
  selectSavestateMemorySearchEntries,
} from './savestate-memory-search-limit.js';
import {
  parseSavestateMemorySearchOffset,
  selectSavestateMemorySearchOffsetEntries,
} from './savestate-memory-search-offset.js';
import { parseSavestateMemoryStoreLimit, selectSavestateMemoryStoreEntries } from './savestate-memory-store-limit.js';
import { parseSavestateRestoreLimit, selectSavestateRestoreEntries } from './savestate-restore-limit.js';
import { parseSavestateSnapshotLimit, selectSavestateSnapshotEntries } from './savestate-snapshot-limit.js';
import { parseSavestateStatsLimit, selectSavestateStatsEntries } from './savestate-stats-limit.js';
import { parseSavestateStatusLimit, selectSavestateStatusEntries } from './savestate-status-limit.js';
import { parseSearchMemoryLimit, selectSearchMemoryEntries } from './search-memory-limit.js';
import { parseSearchSnapshotsLimit, selectSearchSnapshotsEntries } from './search-snapshots-limit.js';
import { parseMemoriesResourceLimit, selectMemoriesResourceEntries } from './memories-resource-limit.js';
import { parseSnapshotsResourceLimit, selectSnapshotsResourceEntries } from './snapshots-resource-limit.js';
import { parseSnapshotsResourceOffset, selectSnapshotsResourceOffsetEntries } from './snapshots-resource-offset.js';

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
        limit: {
          type: 'number',
          description: 'Maximum number of status field rows to return (positive integer up to 1000)',
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
        limit: {
          type: 'number',
          description: 'Maximum number of status field rows to return (positive integer up to 1000)',
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
          description: 'Maximum number of snapshots to return (default: 10; positive integer up to 1000)',
        },
        offset: {
          type: 'number',
          description: 'Pagination offset (non-negative integer up to 1000)',
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
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of status field rows to return (positive integer up to 1000)',
        },
      },
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
        limit: {
          type: 'number',
          description: 'Maximum number of confirmation field rows to return (positive integer up to 1000)',
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
          description: 'Maximum results to return (default: 10; positive integer up to 1000)',
        },
        offset: {
          type: 'number',
          description: 'Pagination offset (non-negative integer up to 1000)',
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
        limit: {
          type: 'number',
          description: 'Maximum number of confirmation field rows to return (positive integer up to 1000)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'savestate_search_snapshots',
    description:
      'Search across ALL encrypted SaveState snapshots (not just live memory). ' +
      'Decrypts and scores matches across memory entries, identity/personality docs, ' +
      'conversation titles, and knowledge documents. Useful for recalling something ' +
      'the user said weeks or months ago, even on a different platform.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        type: {
          type: 'string',
          enum: ['memory', 'conversation', 'identity', 'knowledge'],
          description: 'Optional filter by content type',
        },
        limit: { type: 'number', description: 'Maximum results (default: 20; positive integer up to 1000)' },
        passphrase: { type: 'string', description: 'Decryption passphrase' },
      },
      required: ['query', 'passphrase'],
    },
  },
  {
    name: 'savestate_stats',
    description:
      'Return aggregate statistics about the local snapshot index: total snapshots, ' +
      'storage usage, time covered, average cadence, adapter mix, and top tags. ' +
      'Useful for surfacing the user\'s own AI history back to them.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum snapshots to aggregate (positive integer up to 1000; most recent first)',
        },
      },
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
        limit: {
          type: 'number',
          description: 'Maximum memories to store in this call (positive integer up to 1000)',
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
          description: 'Maximum results (default: 10; positive integer up to 1000)',
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
          description: 'Maximum results (default: 50; positive integer up to 1000)',
        },
        offset: {
          type: 'number',
          description: 'Pagination offset (non-negative integer up to 1000)',
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
        limit: {
          type: 'number',
          description: 'Maximum number of confirmation field rows to return (positive integer up to 1000)',
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
        limit: {
          type: 'number',
          description: 'Maximum memories to delete in this call (positive integer up to 1000)',
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
    description: 'List of available snapshots (default 50; ?limit= is a positive integer up to 1000; ?offset= is a non-negative integer up to 1000)',
    mimeType: 'application/json',
  },
  {
    uri: 'savestate://memories',
    name: 'Memories',
    description: 'Memory entries (default 50; ?limit= is a positive integer up to 1000)',
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
  limit: z.number().optional(),
});

const RestoreInputSchema = z.object({
  snapshotId: z.string(),
  adapter: z.string().optional(),
  dryRun: z.boolean().optional(),
  passphrase: z.string(),
  limit: z.number().optional(),
});

const ListInputSchema = z.object({
  limit: z.number().optional(),
  offset: z.number().optional(),
  platform: z.string().optional(),
});

const StatusInputSchema = z.object({
  limit: z.number().optional(),
});

const MemoryStoreInputSchema = z.object({
  content: z.string(),
  type: z.enum(['fact', 'event', 'preference', 'conversation']).optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  limit: z.number().optional(),
});

const MemorySearchInputSchema = z.object({
  query: z.string().optional(),
  type: z.enum(['fact', 'event', 'preference', 'conversation']).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  minImportance: z.number().optional(),
});

const MemoryDeleteInputSchema = z.object({
  id: z.string(),
  limit: z.number().optional(),
});

const DeleteMemoryInputSchema = z.object({
  id: z.string(),
  limit: z.number().optional(),
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
  limit: z.number().optional(),
});

const ListMemoriesInputSchema = z.object({
  type: z.enum(['fact', 'event', 'preference', 'conversation']).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

const DeleteAllMemoriesInputSchema = z.object({
  confirm: z.boolean(),
  limit: z.number().optional(),
});

const SearchSnapshotsInputSchema = z.object({
  query: z.string(),
  type: z.enum(['memory', 'conversation', 'identity', 'knowledge']).optional(),
  limit: z.number().optional(),
  passphrase: z.string(),
});

const StatsInputSchema = z.object({
  limit: z.number().optional(),
});

// ─── Tool Handlers ───────────────────────────────────────────

async function handleSnapshot(
  input: z.infer<typeof SnapshotInputSchema>,
): Promise<string> {
  try {
    const limit = parseSavestateSnapshotLimit(input.limit);

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

    const result = await createSnapshot(adapter, storage, input.passphrase, {
      label: input.label,
      tags: input.tags,
      full: input.full,
    });

    const fields: Array<{ key: string; value: string }> = [
      { key: 'id', value: result.snapshot.manifest.id },
      { key: 'adapter', value: adapter.name },
      { key: 'type', value: result.incremental ? 'incremental' : 'full' },
    ];

    if (input.label) {
      fields.push({ key: 'label', value: input.label });
    }

    if (result.incremental && result.delta) {
      fields.push({
        key: 'changes',
        value: `+${result.delta.added} added, ~${result.delta.modified} modified, -${result.delta.removed} removed`,
      });
      fields.push({ key: 'chainDepth', value: String(result.delta.chainDepth) });
    }

    fields.push({ key: 'files', value: String(result.fileCount) });
    fields.push({ key: 'archiveSize', value: formatBytes(result.archiveSize) });
    fields.push({ key: 'encryptedSize', value: formatBytes(result.encryptedSize) });
    fields.push({ key: 'storage', value: config.storage.type });

    const selected = selectSavestateSnapshotEntries(fields, limit);
    const lines = ['Snapshot created successfully!', ''];

    for (const field of selected) {
      switch (field.key) {
        case 'id':
          lines.push(`ID: ${field.value}`);
          break;
        case 'adapter':
          lines.push(`Adapter: ${field.value}`);
          break;
        case 'type':
          lines.push(`Type: ${field.value}`);
          break;
        case 'label':
          lines.push(`Label: ${field.value}`);
          break;
        case 'changes':
          lines.push(`Changes: ${field.value}`);
          break;
        case 'chainDepth':
          lines.push(`Chain depth: ${field.value}`);
          break;
        case 'files':
          lines.push(`Files: ${field.value}`);
          break;
        case 'archiveSize':
          lines.push(`Archive size: ${field.value}`);
          break;
        case 'encryptedSize':
          lines.push(`Encrypted size: ${field.value}`);
          break;
        case 'storage':
          lines.push(`Storage: ${field.value}`);
          break;
        default:
          lines.push(`${field.key}: ${field.value}`);
      }
    }

    return lines.join('\n');
  } catch (err) {
    return `Error creating snapshot: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function handleRestore(
  input: z.infer<typeof RestoreInputSchema>,
): Promise<string> {
  try {
    const limit = parseSavestateRestoreLimit(input.limit);

    if (!isInitialized()) {
      return 'Error: SaveState not initialized. Run `savestate init` first.';
    }

    const config = await loadConfig();

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

    const result = await restoreSnapshot(
      input.snapshotId,
      adapter,
      storage,
      input.passphrase,
      { dryRun: input.dryRun },
    );

    const fields: Array<{ key: string; value: string }> = [
      { key: 'snapshot', value: result.snapshotId },
      { key: 'timestamp', value: result.timestamp },
      { key: 'platform', value: result.platform },
      { key: 'adapter', value: result.adapter },
    ];

    if (result.label) {
      fields.push({ key: 'label', value: result.label });
    }

    fields.push({ key: 'identity', value: result.hasIdentity ? 'restored' : 'none' });
    fields.push({ key: 'memoryEntries', value: String(result.memoryCount) });
    fields.push({ key: 'conversations', value: String(result.conversationCount) });

    const selected = selectSavestateRestoreEntries(fields, limit);
    const lines = [
      input.dryRun ? 'Dry run complete (no changes made)' : 'Restore complete!',
      '',
    ];

    for (const field of selected) {
      switch (field.key) {
        case 'snapshot':
          lines.push(`Snapshot: ${field.value}`);
          break;
        case 'timestamp':
          lines.push(`Timestamp: ${field.value}`);
          break;
        case 'platform':
          lines.push(`Platform: ${field.value}`);
          break;
        case 'adapter':
          lines.push(`Adapter: ${field.value}`);
          break;
        case 'label':
          lines.push(`Label: ${field.value}`);
          break;
        case 'identity':
          lines.push(`Identity: ${field.value}`);
          break;
        case 'memoryEntries':
          lines.push(`Memory entries: ${field.value}`);
          break;
        case 'conversations':
          lines.push(`Conversations: ${field.value}`);
          break;
        default:
          lines.push(`${field.key}: ${field.value}`);
      }
    }

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

    const offset = parseSavestateListOffset(input.offset);
    entries = selectSavestateListOffsetEntries(entries, offset);
    const limit = parseSavestateListLimit(input.limit);
    entries = selectSavestateListEntries(entries, limit ?? 10);

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

async function handleStatus(
  input: z.infer<typeof StatusInputSchema>,
): Promise<string> {
  try {
    const limit = parseSavestateStatusLimit(input.limit);
    const initialized = isInitialized();

    if (!initialized) {
      const fields = [
        { key: 'status', value: 'Not initialized' },
        { key: 'hint', value: 'Run `savestate init` to set up SaveState in this directory.' },
      ];
      const selected = selectSavestateStatusEntries(fields, limit);
      return selected.map((field) =>
        field.key === 'status' ? `SaveState Status: ${field.value}` : field.value,
      ).join('\n');
    }

    const config = await loadConfig();
    const adapter = await detectAdapter();
    const fields: Array<{ key: string; value: string }> = [
      { key: 'status', value: 'Initialized' },
      { key: 'storage', value: config.storage.type },
      { key: 'defaultAdapter', value: config.defaultAdapter ?? 'auto-detect' },
      { key: 'detectedAdapter', value: adapter ? adapter.name : 'none' },
    ];

    if (adapter) {
      fields.push({ key: 'adapterVersion', value: adapter.version });
    }

    const store = getMemoryStore();
    const stats = store.getStats();
    fields.push({ key: 'memoryTotal', value: String(stats.totalEntries) });
    fields.push({ key: 'memoryFacts', value: String(stats.byType.fact) });
    fields.push({ key: 'memoryEvents', value: String(stats.byType.event) });
    fields.push({ key: 'memoryPreferences', value: String(stats.byType.preference) });
    fields.push({ key: 'memoryConversations', value: String(stats.byType.conversation) });

    if (config.mcp) {
      fields.push({ key: 'mcpEnabled', value: String(config.mcp.enabled) });
      fields.push({ key: 'mcpPort', value: String(config.mcp.port) });
      fields.push({ key: 'mcpAuth', value: config.mcp.auth.type });
    }

    const selected = selectSavestateStatusEntries(fields, limit);
    const lines: string[] = [];

    for (const field of selected) {
      switch (field.key) {
        case 'status':
          lines.push(`SaveState Status: ${field.value}`);
          break;
        case 'storage':
          lines.push(`Storage: ${field.value}`);
          break;
        case 'defaultAdapter':
          lines.push(`Default adapter: ${field.value}`);
          break;
        case 'detectedAdapter':
          lines.push(`Detected adapter: ${field.value}`);
          break;
        case 'adapterVersion':
          lines.push(`Adapter version: ${field.value}`);
          break;
        case 'memoryTotal':
          lines.push('Memory Store:');
          lines.push(`  Total entries: ${field.value}`);
          break;
        case 'memoryFacts':
          lines.push(`  Facts: ${field.value}`);
          break;
        case 'memoryEvents':
          lines.push(`  Events: ${field.value}`);
          break;
        case 'memoryPreferences':
          lines.push(`  Preferences: ${field.value}`);
          break;
        case 'memoryConversations':
          lines.push(`  Conversations: ${field.value}`);
          break;
        case 'mcpEnabled':
          lines.push('MCP Configuration:');
          lines.push(`  Enabled: ${field.value}`);
          break;
        case 'mcpPort':
          lines.push(`  Port: ${field.value}`);
          break;
        case 'mcpAuth':
          lines.push(`  Auth: ${field.value}`);
          break;
        default:
          lines.push(`${field.key}: ${field.value}`);
      }
    }

    return lines.join('\n');
  } catch (err) {
    return `Error checking status: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Memory Tool Handlers ────────────────────────────────────

async function handleMemoryStore(
  input: z.infer<typeof MemoryStoreInputSchema>,
): Promise<string> {
  try {
    const store = getMemoryStore();
    const limit = parseSavestateMemoryStoreLimit(input.limit);

    const memory = await store.create({
      type: input.type ?? 'fact',
      content: input.content,
      tags: input.tags,
      importance: input.importance,
      metadata: input.metadata,
    });

    const fields = [
      { key: 'id', value: memory.id },
      { key: 'type', value: memory.type },
      { key: 'tags', value: memory.tags?.join(', ') ?? 'none' },
      { key: 'importance', value: String(memory.importance) },
      { key: 'created', value: memory.createdAt },
    ];
    const selected = selectSavestateMemoryStoreEntries(fields, limit);
    const lines = ['Memory stored successfully!', ''];

    for (const field of selected) {
      switch (field.key) {
        case 'id':
          lines.push(`ID: ${field.value}`);
          break;
        case 'type':
          lines.push(`Type: ${field.value}`);
          break;
        case 'tags':
          lines.push(`Tags: ${field.value}`);
          break;
        case 'importance':
          lines.push(`Importance: ${field.value}`);
          break;
        case 'created':
          lines.push(`Created: ${field.value}`);
          break;
        default:
          lines.push(`${field.key}: ${field.value}`);
      }
    }

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

    const limit = parseSavestateMemorySearchLimit(input.limit);
    const offset = parseSavestateMemorySearchOffset(input.offset);
    const query: MemoryQuery = {
      type: input.type,
      tags: input.tags,
      search: input.query,
      limit: (offset ?? 0) + (limit ?? 10),
      minImportance: input.minImportance,
    };

    const results = selectSavestateMemorySearchEntries(
      selectSavestateMemorySearchOffsetEntries(await store.query(query), offset),
      limit ?? 10,
    );

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
    const limit = parseSavestateMemoryDeleteLimit(input.limit);
    const deleted = store.delete(input.id);

    if (!deleted) {
      return `Memory not found: ${input.id}`;
    }

    const fields = [
      { key: 'id', value: input.id },
    ];
    const selected = selectSavestateMemoryDeleteEntries(fields, limit);
    const lines = ['Memory deleted successfully!', ''];

    for (const field of selected) {
      switch (field.key) {
        case 'id':
          lines.push(`ID: ${field.value}`);
          break;
        default:
          lines.push(`${field.key}: ${field.value}`);
      }
    }

    return lines.join('\n');
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
    const limit = parseAddMemoriesLimit(input.limit);

    // Handle array of memories
    if (input.memories && input.memories.length > 0) {
      for (const mem of selectAddMemoriesEntries(input.memories, limit)) {
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
  parseSearchMemoryLimit(input.limit);
  return handleMemorySearch(input);
}

async function handleListMemories(
  input: z.infer<typeof ListMemoriesInputSchema>,
): Promise<string> {
  try {
    const store = getMemoryStore();

    const limit = parseListMemoriesLimit(input.limit);
    const offset = parseListMemoriesOffset(input.offset);
    const query: MemoryQuery = {
      type: input.type,
      tags: input.tags,
      limit: limit ?? 50,
      offset,
    };

    const results = selectListMemoriesEntries(await store.query(query), limit);
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
  input: z.infer<typeof DeleteMemoryInputSchema>,
): Promise<string> {
  try {
    const store = getMemoryStore();
    const limit = parseDeleteMemoryLimit(input.limit);
    const deleted = store.delete(input.id);

    if (!deleted) {
      return `Memory not found: ${input.id}`;
    }

    const fields = [
      { key: 'id', value: input.id },
    ];
    const selected = selectDeleteMemoryEntries(fields, limit);
    const lines = ['Memory deleted successfully!', ''];

    for (const field of selected) {
      switch (field.key) {
        case 'id':
          lines.push(`ID: ${field.value}`);
          break;
        default:
          lines.push(`${field.key}: ${field.value}`);
      }
    }

    return lines.join('\n');
  } catch (err) {
    return `Error deleting memory: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function handleDeleteAllMemories(
  input: z.infer<typeof DeleteAllMemoriesInputSchema>,
): Promise<string> {
  if (!input.confirm) {
    return 'Error: Must set confirm=true to delete all memories.';
  }

  try {
    const store = getMemoryStore();
    const limit = parseDeleteAllMemoriesLimit(input.limit);

    if (limit === undefined) {
      const stats = store.getStats();
      const count = stats.totalEntries;
      store.clear();
      return [
        'All memories deleted.',
        '',
        `Deleted: ${count} memory(ies)`,
      ].join('\n');
    }

    const entries = selectDeleteAllMemoriesEntries(await store.query({ limit }), limit);
    for (const memory of entries) {
      store.delete(memory.id);
    }

    return [
      'Memories deleted.',
      '',
      `Deleted: ${entries.length} memory(ies)`,
    ].join('\n');
  } catch (err) {
    return `Error deleting memories: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function handleSearchSnapshots(
  input: z.infer<typeof SearchSnapshotsInputSchema>,
): Promise<string> {
  const { searchSnapshots } = await import('../search.js');
  try {
    if (!isInitialized()) {
      return 'Error: SaveState not initialized in this directory. Run `savestate init` first.';
    }
    const config = await loadConfig();
    const limit = parseSearchSnapshotsLimit(input.limit);
    const results = selectSearchSnapshotsEntries(
      await searchSnapshots(input.query, config, {
        types: input.type ? [input.type] : undefined,
        limit: limit ?? 20,
        passphrase: input.passphrase,
      }),
      limit,
    );
    if (results.length === 0) return 'No matches found across snapshots.';

    const lines: string[] = [`Found ${results.length} match(es):`, ''];
    for (const r of results) {
      const date = r.snapshotTimestamp.slice(0, 10);
      const score = (r.score * 100).toFixed(0);
      lines.push(`[${r.type}] ${r.snapshotId} (${date}) — ${score}% relevance`);
      if (r.context) lines.push(`  ${r.context}`);
      lines.push(`  ${r.path}`);
      lines.push('');
    }
    return lines.join('\n');
  } catch (err) {
    return `Error searching snapshots: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function handleStats(
  input: z.infer<typeof StatsInputSchema>,
): Promise<string> {
  const { computeStats } = await import('../commands/stats.js');
  try {
    if (!isInitialized()) {
      return 'Error: SaveState not initialized. Run `savestate init` first.';
    }
    const index = await loadIndex();
    const limit = parseSavestateStatsLimit(input.limit);
    const snapshots = selectSavestateStatsEntries(
      [...index.snapshots].sort(
        (a: SnapshotIndexEntry, b: SnapshotIndexEntry) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
      limit,
    );
    const stats = computeStats(snapshots);
    return JSON.stringify(stats, null, 2);
  } catch (err) {
    return `Error computing stats: ${err instanceof Error ? err.message : String(err)}`;
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

      const rawOffset = url.searchParams.get('offset');
      const offset = rawOffset === null
        ? undefined
        : parseSnapshotsResourceOffset(Number(rawOffset));
      const rawLimit = url.searchParams.get('limit');
      const limit = rawLimit === null
        ? undefined
        : parseSnapshotsResourceLimit(Number(rawLimit));

      const index = await loadIndex();
      const entries = index.snapshots;

      entries.sort((a: SnapshotIndexEntry, b: SnapshotIndexEntry) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const skipped = selectSnapshotsResourceOffsetEntries(entries, offset);
      const selected = selectSnapshotsResourceEntries(skipped, limit ?? 50);

      return JSON.stringify({
        count: selected.length,
        snapshots: selected.map((e: SnapshotIndexEntry) => ({
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
      const rawLimit = url.searchParams.get('limit');
      const limit = rawLimit === null
        ? undefined
        : parseMemoriesResourceLimit(Number(rawLimit));
      const memories = selectMemoriesResourceEntries(
        await store.query({ limit: limit ?? 50 }),
        limit ?? 50,
      );
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
          const input = StatusInputSchema.parse(args);
          result = await handleStatus(input);
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
        case 'savestate_search_snapshots': {
          const input = SearchSnapshotsInputSchema.parse(args);
          result = await handleSearchSnapshots(input);
          break;
        }
        case 'savestate_stats': {
          const input = StatsInputSchema.parse(args);
          result = await handleStats(input);
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
          const input = DeleteMemoryInputSchema.parse(args);
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
