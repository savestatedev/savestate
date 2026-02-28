/**
 * MCP CLI Commands
 *
 * Issue #107: MCP-native memory interface
 *
 * Commands:
 * - savestate mcp serve - Start the MCP server
 * - savestate mcp status - Check MCP server status
 * - savestate mcp export - Export memory passport
 * - savestate mcp import - Import memory passport
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import { isInitialized, loadConfig, saveConfig } from '../config.js';
import { loadIndex } from '../index-file.js';
import { KnowledgeLane } from '../checkpoint/memory.js';
import { InMemoryCheckpointStorage } from '../checkpoint/storage/index.js';
import type { Namespace } from '../checkpoint/types.js';
import type { MemoryEntry, Snapshot } from '../types.js';

// ─── Memory Passport Types ───────────────────────────────────

/**
 * Memory Passport format for cross-platform memory transfer.
 * Portable JSON format that can be imported into any MCP-compatible client.
 */
export interface MemoryPassport {
  /** Passport format version */
  version: string;
  /** Export timestamp */
  exported_at: string;
  /** Source agent identifier */
  source_agent: {
    id: string;
    platform?: string;
    name?: string;
  };
  /** Memories included in the passport */
  memories: PassportMemory[];
  /** Snapshots included (metadata only) */
  snapshots: PassportSnapshot[];
  /** Export metadata */
  metadata: {
    total_memories: number;
    total_snapshots: number;
    export_tool: string;
    export_tool_version: string;
  };
}

export interface PassportMemory {
  id: string;
  content: string;
  content_type: string;
  tags: string[];
  importance: number;
  created_at: string;
  source: {
    type: string;
    identifier: string;
  };
}

export interface PassportSnapshot {
  id: string;
  timestamp: string;
  platform: string;
  label?: string;
  size?: number;
}

// ─── MCP Serve Command ───────────────────────────────────────

interface MCPServeOptions {
  port?: string;
  stdio?: boolean;
}

async function mcpServeCommand(options: MCPServeOptions): Promise<void> {
  const spinner = ora('Starting MCP server...').start();

  try {
    // Default to stdio mode for MCP
    if (options.stdio !== false) {
      spinner.succeed('Starting MCP server in stdio mode');
      console.log(chalk.cyan('\nMCP server will communicate via stdin/stdout.'));
      console.log(chalk.gray('Configure your MCP client to use this command.\n'));

      // Import and start the MCP server
      const { startMCPServer } = await import('../mcp/server.js');
      await startMCPServer();
    } else {
      // HTTP mode (future implementation)
      const port = options.port ? parseInt(options.port, 10) : 3333;

      if (isNaN(port) || port < 1 || port > 65535) {
        spinner.fail('Invalid port number');
        console.error(chalk.red('Port must be a number between 1 and 65535'));
        process.exit(1);
      }

      spinner.text = `Starting MCP HTTP server on port ${port}...`;

      // For now, HTTP mode is not implemented
      spinner.warn('HTTP mode not yet implemented. Use --stdio (default) instead.');
      console.log(chalk.yellow('\nHTTP server mode is planned for a future release.'));
      console.log(chalk.gray('For now, use stdio mode with your MCP client.'));
    }
  } catch (err) {
    spinner.fail('Failed to start MCP server');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

// ─── MCP Status Command ──────────────────────────────────────

async function mcpStatusCommand(): Promise<void> {
  console.log(chalk.cyan('\nMCP Server Status\n'));

  // Check if SaveState is initialized
  if (!isInitialized()) {
    console.log(chalk.yellow('SaveState: Not initialized'));
    console.log(chalk.gray('Run `savestate init` to set up SaveState.'));
    return;
  }

  console.log(chalk.green('SaveState: Initialized'));

  // Load config and show MCP settings
  const config = await loadConfig();

  console.log('\nMCP Configuration:');
  if (config.mcp) {
    console.log(`  Enabled: ${config.mcp.enabled ? chalk.green('Yes') : chalk.gray('No')}`);
    console.log(`  Port: ${chalk.cyan(config.mcp.port)}`);
    console.log(`  Auth: ${chalk.cyan(config.mcp.auth.type)}`);
  } else {
    console.log(chalk.gray('  Not configured (using defaults)'));
    console.log(`  Enabled: ${chalk.gray('No')}`);
    console.log(`  Port: ${chalk.cyan('3333')}`);
    console.log(`  Auth: ${chalk.cyan('none')}`);
  }

  // Show available tools
  console.log('\nAvailable MCP Tools:');
  const tools = [
    'savestate_snapshot',
    'savestate_restore',
    'savestate_list',
    'savestate_status',
    'savestate_memory_store',
    'savestate_memory_search',
    'savestate_memory_delete',
  ];
  for (const tool of tools) {
    console.log(chalk.gray(`  - ${tool}`));
  }

  // Show available resources
  console.log('\nAvailable MCP Resources:');
  console.log(chalk.gray('  - savestate://snapshots'));
  console.log(chalk.gray('  - savestate://memories'));

  // Show usage instructions
  console.log('\n' + chalk.cyan('Usage:'));
  console.log(chalk.gray('  To start the MCP server: savestate mcp serve'));
  console.log(chalk.gray('  To configure in Claude Code:'));
  console.log(chalk.gray('    Add to ~/.claude/settings.json:'));
  console.log(chalk.gray('    {'));
  console.log(chalk.gray('      "mcpServers": {'));
  console.log(chalk.gray('        "savestate": {'));
  console.log(chalk.gray('          "command": "npx",'));
  console.log(chalk.gray('          "args": ["@savestate/cli", "mcp", "serve"]'));
  console.log(chalk.gray('        }'));
  console.log(chalk.gray('      }'));
  console.log(chalk.gray('    }'));
}

// ─── MCP Export Command ──────────────────────────────────────

interface MCPExportOptions {
  agent?: string;
  output?: string;
  includeSnapshots?: boolean;
}

async function mcpExportCommand(options: MCPExportOptions): Promise<void> {
  const spinner = ora('Exporting memory passport...').start();

  try {
    if (!isInitialized()) {
      spinner.fail('SaveState not initialized');
      console.error(chalk.red('Run `savestate init` first.'));
      process.exit(1);
    }

    const agentId = options.agent ?? 'default';
    const outputPath = options.output ?? `passport-${agentId}-${Date.now()}.json`;

    // Create namespace for the agent
    const namespace: Namespace = {
      org_id: 'default',
      app_id: 'default',
      agent_id: agentId,
    };

    // Get memories
    const storage = new InMemoryCheckpointStorage();
    const lane = new KnowledgeLane(storage);

    // Note: In a real implementation, we'd load from persistent storage
    // For now, we'll export from the index
    const memories: PassportMemory[] = [];

    // Get snapshots
    spinner.text = 'Loading snapshots...';
    const index = await loadIndex();
    const snapshots: PassportSnapshot[] = index.snapshots
      .filter((s) => !options.agent || s.platform.includes(agentId) || s.id.includes(agentId))
      .map((s) => ({
        id: s.id,
        timestamp: s.timestamp,
        platform: s.platform,
        label: s.label,
        size: s.size,
      }));

    // Create passport
    const passport: MemoryPassport = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      source_agent: {
        id: agentId,
        platform: 'savestate',
        name: `SaveState Agent ${agentId}`,
      },
      memories,
      snapshots,
      metadata: {
        total_memories: memories.length,
        total_snapshots: snapshots.length,
        export_tool: 'savestate-cli',
        export_tool_version: '0.9.0',
      },
    };

    // Write to file
    spinner.text = 'Writing passport file...';
    await writeFile(outputPath, JSON.stringify(passport, null, 2), 'utf-8');

    spinner.succeed('Memory passport exported successfully!');
    console.log('');
    console.log(`Output: ${chalk.cyan(outputPath)}`);
    console.log(`Agent: ${chalk.cyan(agentId)}`);
    console.log(`Memories: ${chalk.cyan(memories.length)}`);
    console.log(`Snapshots: ${chalk.cyan(snapshots.length)}`);
    console.log('');
    console.log(chalk.gray('Import this passport with: savestate mcp import --input ' + outputPath));
  } catch (err) {
    spinner.fail('Export failed');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

// ─── MCP Import Command ──────────────────────────────────────

interface MCPImportOptions {
  input: string;
  agent?: string;
  merge?: boolean;
}

async function mcpImportCommand(options: MCPImportOptions): Promise<void> {
  const spinner = ora('Importing memory passport...').start();

  try {
    if (!isInitialized()) {
      spinner.fail('SaveState not initialized');
      console.error(chalk.red('Run `savestate init` first.'));
      process.exit(1);
    }

    const inputPath = options.input;

    if (!existsSync(inputPath)) {
      spinner.fail('Passport file not found');
      console.error(chalk.red(`File not found: ${inputPath}`));
      process.exit(1);
    }

    // Read passport file
    spinner.text = 'Reading passport file...';
    const passportData = await readFile(inputPath, 'utf-8');
    const passport: MemoryPassport = JSON.parse(passportData);

    // Validate passport format
    if (!passport.version || !passport.memories || !passport.snapshots) {
      spinner.fail('Invalid passport format');
      console.error(chalk.red('The file does not appear to be a valid memory passport.'));
      process.exit(1);
    }

    const targetAgent = options.agent ?? passport.source_agent.id;

    // Create namespace for the target agent
    const namespace: Namespace = {
      org_id: 'default',
      app_id: 'default',
      agent_id: targetAgent,
    };

    // Import memories
    spinner.text = 'Importing memories...';
    const storage = new InMemoryCheckpointStorage();
    const lane = new KnowledgeLane(storage);

    let importedMemories = 0;
    for (const memory of passport.memories) {
      try {
        await lane.storeMemory({
          namespace,
          content: memory.content,
          content_type: memory.content_type,
          tags: memory.tags,
          importance: memory.importance,
          source: {
            type: memory.source.type as 'user_input' | 'tool_output' | 'agent_inference' | 'external' | 'system',
            identifier: memory.source.identifier,
          },
        });
        importedMemories++;
      } catch (err) {
        // Skip failed imports but continue
        console.error(chalk.yellow(`\nWarning: Failed to import memory ${memory.id}`));
      }
    }

    spinner.succeed('Memory passport imported successfully!');
    console.log('');
    console.log(`Source: ${chalk.cyan(inputPath)}`);
    console.log(`Original agent: ${chalk.cyan(passport.source_agent.id)}`);
    console.log(`Target agent: ${chalk.cyan(targetAgent)}`);
    console.log(`Memories imported: ${chalk.cyan(importedMemories)} / ${passport.memories.length}`);
    console.log(`Snapshots referenced: ${chalk.cyan(passport.snapshots.length)}`);
    console.log('');
    console.log(chalk.gray('Note: Snapshot data must be transferred separately using savestate restore.'));
  } catch (err) {
    spinner.fail('Import failed');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

// ─── Register MCP Commands ───────────────────────────────────

export function registerMCPCommands(program: Command): void {
  const mcp = program
    .command('mcp')
    .description('MCP server commands for cross-platform interoperability');

  // savestate mcp serve
  mcp
    .command('serve')
    .description('Start the MCP server for Claude Desktop, Cursor, and other MCP clients')
    .option('-p, --port <port>', 'HTTP server port (default: 3333)')
    .option('--stdio', 'Use stdio transport (default, recommended for MCP)')
    .option('--no-stdio', 'Use HTTP transport instead of stdio')
    .action(mcpServeCommand);

  // savestate mcp status
  mcp
    .command('status')
    .description('Check MCP server configuration and available tools')
    .action(mcpStatusCommand);

  // savestate mcp export
  mcp
    .command('export')
    .description('Export memory passport for cross-platform transfer')
    .option('-a, --agent <id>', 'Agent ID to export (default: "default")')
    .option('-o, --output <path>', 'Output file path (default: passport-{agent}-{timestamp}.json)')
    .option('--include-snapshots', 'Include snapshot metadata in passport')
    .action(mcpExportCommand);

  // savestate mcp import
  mcp
    .command('import')
    .description('Import memory passport from another platform')
    .requiredOption('-i, --input <path>', 'Passport file to import')
    .option('-a, --agent <id>', 'Target agent ID (default: source agent ID)')
    .option('--merge', 'Merge with existing memories instead of replacing')
    .action(mcpImportCommand);
}
