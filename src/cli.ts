#!/usr/bin/env node

/**
 * SaveState CLI
 *
 * Your AI's memory. Yours. The portable, encrypted memory layer for every AI.
 *
 * Usage:
 *   savestate init                    Set up encryption + storage
 *   savestate snapshot                Capture current state
 *   savestate restore [snapshot-id]   Restore from a snapshot
 *   savestate list                    List all snapshots
 *   savestate diff <a> <b>            Compare two snapshots
 *   savestate config                  View/edit configuration
 *   savestate adapters                List available adapters
 *   savestate antibodies              Manage failure antibodies
 *   savestate identity                Manage agent identity
 *   savestate integrity               Memory Integrity Grid
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
  antibodiesCommand,
  evalCommand,
  identityCommand,
  registerContainerCommands,
  registerACLCommands,
} from './commands/index.js';
import { loginCommand, logoutCommand } from './commands/login.js';
import { registerTraceCommands } from './commands/trace.js';
import { registerIntegrityCommands } from './commands/integrity.js';
import { verifyCommand } from './commands/verify.js';

// Get version from package.json
const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();

program
  .name('savestate')
  .description('Your AI\'s memory. Yours. Portable, encrypted memory layer for every AI.')
  .version(version);

// ─── savestate init ──────────────────────────────────────────

program
  .command('init')
  .description('Initialize SaveState in the current directory')
  .option('--json', 'Output as JSON')
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
  .option('--tag <entry...>', 'Record structured state entry (type:key=value with type decision, preference, error, api_response, or custom)')
  .option('--meta <entry...>', 'Additional metadata for state entries (key=value with a non-empty key and value)')
  .option('--json', 'Output as JSON')
  .action(snapshotCommand);

// ─── savestate restore ───────────────────────────────────────

program
  .command('restore [snapshot-id]')
  .description('Restore from a snapshot (default: latest; single non-empty snapshot id)')
  .option('--to <platform>', 'Restore to a different platform')
  .option('--dry-run', 'Show what would be restored without making changes')
  .option('--include <categories>', 'Only restore specific categories (identity,memory,conversations)')
  .option('--exclude <categories>', 'Skip restore categories (one or more of: identity, memory, conversations)')
  .option('--since <date>', 'Restore the newest snapshot taken after this date (ISO 8601)')
  .option('--until <date>', 'Restore the newest snapshot taken on or before this date')
  .option('--tag <tag>', 'Restore the newest snapshot with this tag')
  .option('--label <label>', 'Restore the newest snapshot with this label')
  .option('--json', 'Output as JSON')
  .action(restoreCommand);

// ─── savestate list ──────────────────────────────────────────

program
  .command('list')
  .alias('ls')
  .description('List all snapshots')
  .option('--json', 'Output as JSON')
  .option('--limit <n>', 'Maximum number of snapshots to show')
  .option('--since <date>', 'Only snapshots taken after this date (ISO 8601)')
  .option('--until <date>', 'Only snapshots taken before this date (ISO 8601)')
  .option('--adapter <id>', 'Only snapshots from this adapter')
  .option('--exclude <ids>', 'Skip snapshots from these adapters (one or more of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf)')
  .option('--snapshot <id>', 'Only this snapshot (single non-empty snapshot id)')
  .option('--tag <tag>', 'Only snapshots tagged with this label')
  .option('--label <label>', 'Only snapshots with this label (single non-empty snapshot label)')
  .action(listCommand);

// ─── savestate stats ─────────────────────────────────────────

import { statsCommand } from './commands/stats.js';

program
  .command('stats')
  .description('Show usage statistics about your snapshots')
  .option('--json', 'Output as JSON')
  .option('--adapter <id>', 'Only snapshots from this adapter')
  .option('--exclude <ids>', 'Skip snapshots from these adapters (one or more of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf)')
  .option('--snapshot <id>', 'Only this snapshot (single non-empty snapshot id)')
  .option('--since <date>', 'Only snapshots taken after this date (ISO 8601)')
  .option('--until <date>', 'Only snapshots taken before this date (ISO 8601)')
  .option('--tag <tag>', 'Only snapshots tagged with this label')
  .option('--label <label>', 'Only snapshots with this label (single non-empty snapshot label)')
  .option('--limit <n>', 'Only aggregate the N most recent snapshots')
  .action(statsCommand);

// ─── savestate doctor ────────────────────────────────────────

import { doctorCommand } from './commands/doctor.js';

program
  .command('doctor')
  .description('Health-check every snapshot: decrypt, unpack, verify checksums, walk chains')
  .option('--json', 'Output as JSON')
  .option('--adapter <id>', 'Only check snapshots from this adapter')
  .option('--exclude <ids>', 'Skip snapshots from these adapters (one or more of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf)')
  .option('--snapshot <id>', 'Only check this snapshot (single non-empty snapshot id)')
  .option('--since <date>', 'Only check snapshots taken after this date (ISO 8601)')
  .option('--until <date>', 'Only check snapshots taken before this date (ISO 8601)')
  .option('--tag <tag>', 'Only check snapshots with this tag')
  .option('--label <label>', 'Only check snapshots with this label')
  .option('--limit <n>', 'Only check the N most recent snapshots')
  .action(doctorCommand);

// ─── savestate inspect ───────────────────────────────────────

import { inspectCommand } from './commands/inspect.js';

program
  .command('inspect <snapshot-id>')
  .description('Decrypt and summarize a snapshot without restoring it (single non-empty snapshot id)')
  .option('--exclude <ids>', 'Skip snapshots from these adapters (one or more of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf)')
  .option('--since <date>', 'Inspect the newest snapshot taken after this date (ISO 8601)')
  .option('--until <date>', 'Inspect the newest snapshot taken on or before this date (ISO 8601)')
  .option('--tag <tag>', 'Only inspect a snapshot with this tag')
  .option('--label <label>', 'Only inspect a snapshot with this label')
  .option('--json', 'Output as JSON')
  .action(inspectCommand);

// ─── savestate trust ─────────────────────────────────────────

import {
  trustStatusCommand,
  trustAuditCommand,
  trustDenyAddCommand,
  trustDenyRemoveCommand,
  trustDenyListCommand,
} from './commands/trust.js';

const trustCmd = program
  .command('trust')
  .description('Inspect Trust Kernel state, audit trail, and denylist');

trustCmd
  .command('status')
  .description('Show Trust Kernel metrics: entries by state/scope, denylist size, recent activity')
  .option('--json', 'Output as JSON')
  .action(trustStatusCommand);

trustCmd
  .command('audit')
  .description('Show recent state-transition events')
  .option('--limit <n>', 'Number of recent events to show')
  .option('--json', 'Output as JSON')
  .action(trustAuditCommand);

const denyCmd = trustCmd
  .command('deny')
  .description('Manage the Trust Kernel denylist (patterns blocked at the WriteGate)');

denyCmd
  .command('add <pattern>')
  .description('Add a pattern to the denylist (single non-empty pattern)')
  .option('-r, --reason <reason>', 'Why this pattern is denylisted (non-empty)')
  .option('-b, --by <actor>', 'Who is adding this entry (defaults to "cli", single non-empty actor id)')
  .option('--json', 'Output as JSON')
  .action(trustDenyAddCommand);

denyCmd
  .command('remove <pattern>')
  .alias('rm')
  .description('Remove a pattern from the denylist (exact match; single non-empty pattern)')
  .option('--json', 'Output as JSON')
  .action(trustDenyRemoveCommand);

denyCmd
  .command('list')
  .alias('ls')
  .description('Show all denylist entries')
  .option('--json', 'Output as JSON')
  .action(trustDenyListCommand);

// ─── savestate prune ─────────────────────────────────────────

import { pruneCommand } from './commands/prune.js';

program
  .command('prune')
  .description('Drop old snapshots according to a retention policy (dry-run by default)')
  .option('--keep-last <n>', 'Keep the N most recent snapshots')
  .option('--older-than <date>', 'Drop snapshots older than this date (ISO 8601)')
  .option('--adapter <id>', 'Only prune snapshots from this adapter')
  .option('--exclude <ids>', 'Skip snapshots from these adapters (one or more of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf)')
  .option('--since <date>', 'Only prune snapshots taken after this date (ISO 8601)')
  .option('--until <date>', 'Only prune snapshots taken before this date (ISO 8601)')
  .option('--snapshot <id>', 'Only prune this snapshot (single non-empty snapshot id)')
  .option('--tag <tag>', 'Only prune snapshots with this tag')
  .option('--label <label>', 'Only prune snapshots with this label')
  .option('--limit <n>', 'Only consider the N most recent snapshots')
  .option('--apply', 'Actually delete (default is dry-run)')
  .option('--json', 'Output the plan as JSON')
  .action(pruneCommand);

// ─── savestate diff ──────────────────────────────────────────

program
  .command('diff <a> <b>')
  .description('Compare two snapshots (single non-empty snapshot ids)')
  .option('--json', 'Output as JSON')
  .action(diffCommand);

// ─── savestate config ────────────────────────────────────────

program
  .command('config')
  .description('View/edit SaveState configuration')
  .option('--set <key=value>', 'Set a config value (non-empty key=value)')
  .option('--json', 'Output as JSON')
  .action(configCommand);

// ─── savestate adapters ──────────────────────────────────────

program
  .command('adapters')
  .description('List available platform adapters')
  .option('--json', 'Output as JSON')
  .action(adaptersCommand);

// ─── savestate antibodies ───────────────────────────────────

program
  .command('antibodies <subcommand>')
  .description('Failure antibody system (list, add, preflight, stats; single non-empty subcommand: list, add, preflight, or stats)')
  .option('--id <id>', 'Rule ID (for manual add)')
  .option('--all', 'Include retired rules in list')
  .option('--json', 'Output as JSON')
  .option('--tool <tool>', 'Tool name in trigger/context')
  .option('--error-code <code>', 'Error code in trigger/context')
  .option('--path <path>', 'Path in preflight context')
  .option('--path-prefix <prefix>', 'Path prefix in rule trigger')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--risk <risk>', 'Risk level (low, medium, high, critical)')
  .option('--safe-action <type>', 'Safe action type for manual rule')
  .option('--confidence <0..1>', 'Rule confidence (0-1)')
  .option('--semantic', 'Enable semantic matcher stub')
  .action(antibodiesCommand);

// ─── savestate eval ──────────────────────────────────────────

program
  .command('eval <subcommand>')
  .description('Memory quality evaluation (quality, report; single non-empty subcommand: quality or report)')
  .option('--json', 'Output as JSON')
  .option('--threshold <0..1>', 'Confidence threshold (default: 0.7)')
  .option('--suite <name>', 'Run only a specific benchmark suite')
  .option('-v, --verbose', 'Show detailed test results')
  .action(evalCommand);

// ─── savestate search ────────────────────────────────────────

import { searchCommand } from './commands/search.js';

program
  .command('search <query>')
  .description('Search across all snapshots (non-empty query)')
  .option('--type <type>', 'Filter by type (one or more of: memory, conversation, identity, knowledge)')
  .option('--exclude <types>', 'Skip search types (one or more of: memory, conversation, identity, knowledge)')
  .option('--since <date>', 'Only snapshots taken after this date (ISO 8601)')
  .option('--until <date>', 'Only snapshots taken before this date (ISO 8601)')
  .option('--limit <n>', 'Maximum results')
  .option('--snapshot <id>', 'Search within a specific snapshot')
  .option('--adapter <id>', 'Only search snapshots from this adapter')
  .option('--tag <tag>', 'Only search snapshots with this tag')
  .option('--label <label>', 'Only search snapshots with this label')
  .option('--json', 'Output as JSON')
  .action(searchCommand);

// ─── savestate login ─────────────────────────────────────────

program
  .command('login')
  .description('Authenticate with SaveState cloud')
  .option('-k, --key <api-key>', 'API key (single non-empty key, or enter interactively)')
  .option('--json', 'Output as JSON')
  .action(loginCommand);

// ─── savestate logout ────────────────────────────────────────

program
  .command('logout')
  .description('Remove saved API key')
  .option('--json', 'Output as JSON')
  .action(logoutCommand);

// ─── savestate schedule ──────────────────────────────────────

import { scheduleCommand } from './commands/schedule.js';

program
  .command('schedule')
  .description('Configure automatic backup schedule (Pro/Team)')
  .option('-e, --every <interval>', 'Backup interval (e.g., 1h, 6h, 12h, 1d)')
  .option('-d, --disable', 'Disable scheduled backups')
  .option('-s, --status', 'Show schedule status')
  .option('--json', 'Output as JSON')
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
  .option('-i, --include <types>', 'Only migrate specific types (one or more of: instructions, memories, conversations, files, customBots)')
  .option('--exclude <types>', 'Skip migrate types (one or more of: instructions, memories, conversations, files, customBots)')
  .option('-l, --list', 'List available platforms and their capabilities')
  .option('--json', 'Output as JSON')
  .option('--no-color', 'Disable colorized output')
  .option('--force', 'Skip confirmation prompts')
  .option('-v, --verbose', 'Show detailed progress')
  .action(migrateCommand);

// ─── savestate cloud ─────────────────────────────────────────

import { cloudCommand } from './commands/cloud.js';

program
  .command('cloud <subcommand>')
  .description('Cloud storage commands (Pro/Team; single non-empty subcommand: push, pull, list, or delete)')
  .option('--id <id>', 'Specific snapshot ID (single non-empty id)')
  .option('--all', 'Process all snapshots')
  .option('-f, --force', 'Overwrite existing files')
  .option('--json', 'Output as JSON')
  .action(cloudCommand);

// ─── savestate team ──────────────────────────────────────────

import { teamCommand } from './commands/team.js';

program
  .command('team <subcommand> [args...]')
  .description('Team management (Team tier; single non-empty subcommand: status, members, invite, or audit; invite requires a single non-empty email address)')
  .option('-r, --role <role>', 'Role: admin, member, or viewer', 'member')
  .option('--json', 'Output as JSON')
  .option('--since <date>', 'Only entries after this date (ISO 8601)')
  .option('--until <date>', 'Only entries before this date (ISO 8601)')
  .option('--format <format>', 'Output format: csv or json', 'json')
  .action(teamCommand);

// ─── savestate trace ─────────────────────────────────────────

registerTraceCommands(program);
registerContainerCommands(program);
registerACLCommands(program);

// ─── savestate verify ────────────────────────────────────────

program
  .command('verify <file>')
  .description('Verify integrity of a .savestate file and list packed components (single non-empty path)')
  .option('-p, --passphrase <pass>', 'Passphrase for verification (non-empty)')
  .option('-k, --keyfile <path>', 'Keyfile for verification (alternative to passphrase; single non-empty path)')
  .option('--json', 'Output as JSON')
  .action(verifyCommand);

// ─── savestate memory ────────────────────────────────────────

import { registerMemoryCommands } from './commands/memory-cli.js';

registerMemoryCommands(program);

// ─── savestate slo ───────────────────────────────────────────

import { registerSLOCommands } from './commands/slo.js';

registerSLOCommands(program);

// ─── savestate mcp ───────────────────────────────────────────

import { registerMCPCommands } from './commands/mcp.js';
import { registerContextCommands } from './commands/context.js';

registerMCPCommands(program);

// ─── savestate context ─────────────────────────────────────

registerContextCommands(program);

// ─── savestate identity ────────────────────────────────────

program
  .command('identity <subcommand> [args...]')
    .description('Manage agent identity (show, init, set, schema; single non-empty subcommand: show, init, set, or schema; init requires a single non-empty identity name; set requires a single non-empty identity field and a non-empty identity value)')
  .option('--json', 'Output as JSON')
  .action(identityCommand);

// ─── savestate integrity ───────────────────────────────────

registerIntegrityCommands(program);

// ─── Parse & run ─────────────────────────────────────────────

program.parse();
