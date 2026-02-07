#!/usr/bin/env node
/**
 * SaveState MCP Server
 *
 * Exposes SaveState functionality as MCP tools for Claude Code integration.
 * Uses stdio transport for seamless Claude Code integration.
 *
 * Tools:
 * - savestate_snapshot: Create a new snapshot of the current workspace
 * - savestate_restore: Restore from a snapshot
 * - savestate_list: List available snapshots
 * - savestate_diff: Compare two snapshots
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
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { isInitialized, loadConfig } from '../config.js';
import { detectAdapter, getAdapter } from '../adapters/registry.js';
import { createSnapshot } from '../snapshot.js';
import { restoreSnapshot } from '../restore.js';
import { resolveStorage } from '../storage/resolve.js';
import { loadIndex, type SnapshotIndexEntry } from '../index-file.js';

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
      `✓ Snapshot created successfully!`,
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
      input.dryRun ? '✓ Dry run complete (no changes made)' : '✓ Restore complete!',
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
      lines.push(`• ${entry.id}${labelPart}`);
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
    'SaveState Status: Initialized ✓',
    '',
    `Storage: ${config.storage.type}`,
    `Default adapter: ${config.defaultAdapter ?? 'auto-detect'}`,
    `Detected adapter: ${adapter ? adapter.name : 'none'}`,
  ];

  if (adapter) {
    lines.push(`Adapter version: ${adapter.version}`);
  }

  return lines.join('\n');
}

// ─── Utilities ───────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Server Setup ────────────────────────────────────────────

async function main(): Promise<void> {
  const server = new Server(
    {
      name: 'savestate',
      version: '0.5.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
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

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
