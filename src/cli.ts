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
 *   savestate search <query>          Search across snapshots
 *   savestate diff <a> <b>            Compare two snapshots
 *   savestate config                  View/edit configuration
 *   savestate adapters                List available adapters
 */

import { Command } from 'commander';
import {
  initCommand,
  snapshotCommand,
  restoreCommand,
  listCommand,
  searchCommand,
  diffCommand,
  configCommand,
  adaptersCommand,
} from './commands/index.js';

const program = new Command();

program
  .name('savestate')
  .description('Time Machine for AI. Backup, restore, and migrate your AI identity.')
  .version('0.1.0');

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

// ─── savestate search ────────────────────────────────────────

program
  .command('search <query>')
  .description('Search across all snapshots')
  .option('--type <types>', 'Filter by type (memory,conversation,identity,knowledge)')
  .option('--limit <n>', 'Maximum number of results')
  .option('--snapshot <id>', 'Search within a specific snapshot')
  .action(searchCommand);

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

// ─── Parse & run ─────────────────────────────────────────────

program.parse();
