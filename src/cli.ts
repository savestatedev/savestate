#!/usr/bin/env node

/**
 * SaveState CLI
 *
 * Time Machine for AI. Backup, restore, and migrate your AI identity.
 *
 * Usage:
 *   savestate init                    Set up encryption + storage
 *   savestate snapshot                Capture current state
 *   savestate restore [snapshot-id]   Restore from a snapshot
 *   savestate list                    List all snapshots
 *   savestate diff <a> <b>            Compare two snapshots
 *   savestate config                  View/edit configuration
 *   savestate adapters                List available adapters
 */

import { Command } from 'commander';
import { createRequire } from 'node:module';
import {
  initCommand,
  snapshotCommand,
  restoreCommand,
  listCommand,
  diffCommand,
  configCommand,
  adaptersCommand,
} from './commands/index.js';
import { loginCommand, logoutCommand } from './commands/login.js';

// Get version from package.json
const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();

program
  .name('savestate')
  .description('Time Machine for AI. Backup, restore, and migrate your AI identity.')
  .version(version);

// ─── savestate init ──────────────────────────────────────────

program
  .command('init')
  .description('Initialize SaveState in the current directory')
  .action(initCommand);

// ─── savestate snapshot ──────────────────────────────────────

program
  .command('snapshot')
  .description('Capture current AI state to encrypted archive')
  .option('-l, --label <label>', 'Human-readable label for this snapshot')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('-a, --adapter <adapter>', 'Adapter to use (default: auto-detect)')
  .option('-s, --schedule <interval>', 'Set up auto-snapshot schedule (e.g., 6h, 1d)')
  .option('--full', 'Force a full snapshot (skip incremental)')
  .action(snapshotCommand);

// ─── savestate restore ───────────────────────────────────────

program
  .command('restore [snapshot-id]')
  .description('Restore from a snapshot (default: latest)')
  .option('--to <platform>', 'Restore to a different platform')
  .option('--dry-run', 'Show what would be restored without making changes')
  .option('--include <categories>', 'Only restore specific categories (identity,memory,conversations)')
  .action(restoreCommand);

// ─── savestate list ──────────────────────────────────────────

program
  .command('list')
  .alias('ls')
  .description('List all snapshots')
  .option('--json', 'Output as JSON')
  .option('--limit <n>', 'Maximum number of snapshots to show')
  .action(listCommand);

// ─── savestate diff ──────────────────────────────────────────

program
  .command('diff <a> <b>')
  .description('Compare two snapshots')
  .action(diffCommand);

// ─── savestate config ────────────────────────────────────────

program
  .command('config')
  .description('View/edit SaveState configuration')
  .option('--set <key=value>', 'Set a config value')
  .option('--json', 'Output as JSON')
  .action(configCommand);

// ─── savestate adapters ──────────────────────────────────────

program
  .command('adapters')
  .description('List available platform adapters')
  .action(adaptersCommand);

// ─── savestate search ────────────────────────────────────────

import { searchCommand } from './commands/search.js';

program
  .command('search <query>')
  .description('Search across all snapshots')
  .option('--type <type>', 'Filter by type (memory, conversation, identity)')
  .option('--limit <n>', 'Maximum results')
  .option('--snapshot <id>', 'Search within a specific snapshot')
  .action(searchCommand);

// ─── savestate login ─────────────────────────────────────────

program
  .command('login')
  .description('Authenticate with SaveState cloud')
  .option('-k, --key <api-key>', 'API key (or enter interactively)')
  .action(loginCommand);

// ─── savestate logout ────────────────────────────────────────

program
  .command('logout')
  .description('Remove saved API key')
  .action(logoutCommand);

// ─── savestate schedule ──────────────────────────────────────

import { scheduleCommand } from './commands/schedule.js';

program
  .command('schedule')
  .description('Configure automatic backup schedule (Pro/Team)')
  .option('-e, --every <interval>', 'Backup interval (e.g., 1h, 6h, 12h, 1d)')
  .option('-d, --disable', 'Disable scheduled backups')
  .option('-s, --status', 'Show schedule status')
  .action(scheduleCommand);

// ─── savestate migrate ───────────────────────────────────────

import { migrateCommand } from './commands/migrate.js';

program
  .command('migrate')
  .description('Migrate AI identity between platforms (ChatGPT → Claude, etc.)')
  .option('-f, --from <platform>', 'Source platform to migrate from')
  .option('-t, --to <platform>', 'Target platform to migrate to')
  .option('-s, --snapshot <id>', 'Use existing snapshot instead of creating new one')
  .option('--dry-run', 'Show compatibility report without making changes')
  .option('--review', 'Inspect items needing manual attention')
  .option('--resume', 'Resume an interrupted migration')
  .option('-i, --include <types>', 'Only migrate specific types (instructions,memories,conversations,files,customBots)')
  .option('-l, --list', 'List available platforms and their capabilities')
  .option('--no-color', 'Disable colorized output')
  .option('--force', 'Skip confirmation prompts')
  .option('-v, --verbose', 'Show detailed progress')
  .action(migrateCommand);

// ─── savestate cloud ─────────────────────────────────────────

import { cloudCommand } from './commands/cloud.js';

program
  .command('cloud <subcommand>')
  .description('Cloud storage commands (Pro/Team)')
  .option('--id <id>', 'Specific snapshot ID')
  .option('--all', 'Process all snapshots')
  .option('-f, --force', 'Overwrite existing files')
  .action(cloudCommand);

// ─── savestate mcp ───────────────────────────────────────────

program
  .command('mcp')
  .description('Start MCP server for Claude Code integration')
  .action(async () => {
    // Dynamic import to avoid loading MCP deps for regular CLI usage
    await import('./mcp/server.js');
  });

// ─── Parse & run ─────────────────────────────────────────────

program.parse();
