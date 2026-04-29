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
  registerContainerCommands,
  registerACLCommands,
} from './commands/index.js';
import { loginCommand, logoutCommand } from './commands/login.js';
import { registerTraceCommands } from './commands/trace.js';
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
  .option('--tag <entry...>', 'Record structured state entry (type:key=value)')
  .option('--meta <entry...>', 'Additional metadata for state entries (key=value)')
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
  .option('--since <date>', 'Only snapshots taken after this date (ISO 8601)')
  .option('--until <date>', 'Only snapshots taken before this date (ISO 8601)')
  .option('--adapter <id>', 'Only snapshots from this adapter')
  .option('--tag <tag>', 'Only snapshots tagged with this label')
  .action(listCommand);

// ─── savestate stats ─────────────────────────────────────────

import { statsCommand } from './commands/stats.js';

program
  .command('stats')
  .description('Show usage statistics about your snapshots')
  .option('--json', 'Output as JSON')
  .action(statsCommand);

// ─── savestate doctor ────────────────────────────────────────

import { doctorCommand } from './commands/doctor.js';

program
  .command('doctor')
  .description('Health-check every snapshot: decrypt, unpack, verify checksums, walk chains')
  .option('--json', 'Output as JSON')
  .option('--adapter <id>', 'Only check snapshots from this adapter')
  .option('--limit <n>', 'Only check the N most recent snapshots')
  .action(doctorCommand);

// ─── savestate inspect ───────────────────────────────────────

import { inspectCommand } from './commands/inspect.js';

program
  .command('inspect <snapshot-id>')
  .description('Decrypt and summarize a snapshot without restoring it')
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
  .description('Add a pattern to the denylist')
  .option('-r, --reason <reason>', 'Why this pattern is denylisted')
  .option('-b, --by <actor>', 'Who is adding this entry (defaults to "cli")')
  .option('--json', 'Output as JSON')
  .action(trustDenyAddCommand);

denyCmd
  .command('remove <pattern>')
  .alias('rm')
  .description('Remove a pattern from the denylist (exact match)')
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
  .option('--apply', 'Actually delete (default is dry-run)')
  .option('--json', 'Output the plan as JSON')
  .action(pruneCommand);

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

// ─── savestate antibodies ───────────────────────────────────

program
  .command('antibodies <subcommand>')
  .description('Failure antibody system (list, add, preflight, stats)')
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
  .description('Memory quality evaluation (quality, report)')
  .option('--json', 'Output as JSON')
  .option('--threshold <0..1>', 'Confidence threshold (default: 0.7)')
  .option('--suite <name>', 'Run only a specific benchmark suite')
  .option('-v, --verbose', 'Show detailed test results')
  .action(evalCommand);

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

// ─── savestate team ──────────────────────────────────────────

import {
  teamStatusCommand,
  teamMembersCommand,
  teamInviteCommand,
  teamAuditCommand,
} from './commands/team.js';

const teamCmd = program
  .command('team')
  .description('Team management (Team tier): members, invites, audit log');

teamCmd
  .command('status')
  .description('Show your team membership info')
  .option('--json', 'Output as JSON')
  .action(teamStatusCommand);

teamCmd
  .command('members')
  .description('List team members')
  .option('--json', 'Output as JSON')
  .action(teamMembersCommand);

teamCmd
  .command('invite <email>')
  .description('Invite a member by email')
  .option('-r, --role <role>', 'Role: admin, member, or viewer', 'member')
  .option('--json', 'Output as JSON')
  .action(teamInviteCommand);

teamCmd
  .command('audit')
  .description('Stream the team audit log to stdout')
  .option('--since <date>', 'Only entries after this date (ISO 8601)')
  .option('--until <date>', 'Only entries before this date (ISO 8601)')
  .option('--format <format>', 'Output format: csv or json', 'json')
  .action(teamAuditCommand);

// ─── savestate trace ─────────────────────────────────────────

registerTraceCommands(program);
registerContainerCommands(program);
registerACLCommands(program);

// ─── savestate verify ────────────────────────────────────────

program
  .command('verify <file>')
  .description('Verify integrity of a .savestate file')
  .option('-p, --passphrase <pass>', 'Passphrase for verification')
  .option('-k, --keyfile <path>', 'Keyfile for verification (alternative to passphrase)')
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

// ─── Parse & run ─────────────────────────────────────────────

program.parse();
