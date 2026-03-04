/**
 * SaveState Memory CLI Commands
 *
 * Registers the memory tier management commands and lifecycle controls.
 * Issue #110: Memory Lifecycle Controls - mutation, correction, expiry, audit
 */

import type { Command } from 'commander';
import {
  listMemories,
  promoteMemoryCommand,
  demoteMemoryCommand,
  pinMemoryCommand,
  unpinMemoryCommand,
  applyPoliciesCommand,
  showTierConfig,
  explainMemoryCommand,
} from './memory.js';
import {
  editMemoryCommand,
  deleteMemoryCommand,
  rollbackMemoryCommand,
  expireMemoriesCommand,
  memoryLogCommand,
} from './memory-lifecycle.js';
import { loadConfig } from '../config.js';
import { resolveStorage } from '../storage/index.js';
import type { MemoryTier } from '../types.js';

/**
 * Register memory-related commands on the CLI program.
 */
export function registerMemoryCommands(program: Command): void {
  const memory = program
    .command('memory')
    .description('Manage multi-tier memory (L1/L2/L3) for long-running agents');

  // ─── savestate memory list ───────────────────────────────────

  memory
    .command('list')
    .alias('ls')
    .description('List memories with tier information')
    .option('-t, --tier <tier>', 'Filter by tier (L1, L2, L3)')
    .option('-p, --pinned', 'Show only pinned memories')
    .option('-l, --limit <n>', 'Maximum number of entries to show', '20')
    .option('-s, --snapshot <id>', 'Snapshot to inspect (default: latest)')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await listMemories(storage, passphrase, {
          tier: options.tier as MemoryTier | undefined,
          pinned: options.pinned,
          limit: parseInt(options.limit, 10),
          snapshotId: options.snapshot,
          format: options.json ? 'json' : 'table',
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory promote ────────────────────────────────

  memory
    .command('promote <memory-id>')
    .description('Promote a memory to a higher tier (faster access)')
    .option('-t, --to <tier>', 'Target tier (L1 or L2)', 'L1')
    .option('-s, --snapshot <id>', 'Snapshot to modify (default: latest)')
    .action(async (memoryId, options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await promoteMemoryCommand(storage, passphrase, memoryId, {
          to: options.to as MemoryTier,
          snapshotId: options.snapshot,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory demote ─────────────────────────────────

  memory
    .command('demote <memory-id>')
    .description('Demote a memory to a lower tier (archival)')
    .option('-t, --to <tier>', 'Target tier (L2 or L3)', 'L3')
    .option('-s, --snapshot <id>', 'Snapshot to modify (default: latest)')
    .action(async (memoryId, options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await demoteMemoryCommand(storage, passphrase, memoryId, {
          to: options.to as MemoryTier,
          snapshotId: options.snapshot,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory pin ────────────────────────────────────

  memory
    .command('pin <memory-id>')
    .description('Pin a memory (prevents automatic demotion)')
    .option('-s, --snapshot <id>', 'Snapshot to modify (default: latest)')
    .action(async (memoryId, options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await pinMemoryCommand(storage, passphrase, memoryId, {
          snapshotId: options.snapshot,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory unpin ──────────────────────────────────

  memory
    .command('unpin <memory-id>')
    .description('Unpin a memory (allows automatic demotion)')
    .option('-s, --snapshot <id>', 'Snapshot to modify (default: latest)')
    .action(async (memoryId, options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await unpinMemoryCommand(storage, passphrase, memoryId, {
          snapshotId: options.snapshot,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory apply-policies ─────────────────────────

  memory
    .command('apply-policies')
    .description('Apply automatic tier policies (age-based demotion, etc.)')
    .option('-s, --snapshot <id>', 'Snapshot to modify (default: latest)')
    .option('--dry-run', 'Show what would change without applying')
    .action(async (options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await applyPoliciesCommand(storage, passphrase, {
          snapshotId: options.snapshot,
          dryRun: options.dryRun,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory config ─────────────────────────────────

  memory
    .command('config')
    .description('Show tier configuration')
    .option('-s, --snapshot <id>', 'Snapshot to inspect (default: latest)')
    .action(async (options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await showTierConfig(storage, passphrase, {
          snapshotId: options.snapshot,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory explain ───────────────────────────────

  memory
    .command('explain <query>')
    .description('Explain why memories were retrieved for a query')
    .option('-n, --namespace <ns>', 'Namespace to search (org:app:agent format)')
    .option('-l, --limit <n>', 'Maximum number of results', '5')
    .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
    .option('--json', 'Output as JSON')
    .action(async (query, options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await explainMemoryCommand(storage, passphrase, query, {
          namespace: options.namespace,
          limit: parseInt(options.limit, 10),
          tags: options.tags?.split(',').map((t: string) => t.trim()),
          format: options.json ? 'json' : 'pretty',
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── Lifecycle Controls (Issue #110) ───────────────────────

  // ─── savestate memory edit ──────────────────────────────────

  memory
    .command('edit <memory-id>')
    .description('Edit a memory\'s content or metadata')
    .option('-c, --content <content>', 'New content for the memory')
    .option('-t, --tags <tags>', 'New tags (comma-separated)')
    .option('-i, --importance <n>', 'New importance score (0-1)')
    .option('--actor <id>', 'Actor ID for audit trail', 'cli-user')
    .option('-r, --reason <reason>', 'Reason for the edit')
    .action(async (memoryId, options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await editMemoryCommand(storage, passphrase, memoryId, {
          content: options.content,
          tags: options.tags?.split(',').map((t: string) => t.trim()),
          importance: options.importance ? parseFloat(options.importance) : undefined,
          actorId: options.actor,
          reason: options.reason,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory delete ────────────────────────────────

  memory
    .command('delete <memory-id>')
    .alias('rm')
    .description('Delete a memory (soft delete with audit trail)')
    .option('--actor <id>', 'Actor ID for audit trail', 'cli-user')
    .requiredOption('-r, --reason <reason>', 'Reason for deletion (required)')
    .action(async (memoryId, options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await deleteMemoryCommand(storage, passphrase, memoryId, {
          actorId: options.actor,
          reason: options.reason,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory rollback ──────────────────────────────

  memory
    .command('rollback <memory-id>')
    .description('Rollback a memory to a previous version')
    .requiredOption('-v, --version <n>', 'Version number to rollback to')
    .option('--actor <id>', 'Actor ID for audit trail', 'cli-user')
    .action(async (memoryId, options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await rollbackMemoryCommand(storage, passphrase, memoryId, {
          version: parseInt(options.version, 10),
          actorId: options.actor,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory expire ────────────────────────────────

  memory
    .command('expire')
    .description('Expire memories based on TTL policy')
    .requiredOption('-n, --namespace <ns>', 'Namespace (format: org:app:agent[:user])')
    .option('--dry-run', 'Show what would be expired without applying')
    .action(async (options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await expireMemoriesCommand(storage, passphrase, {
          namespace: options.namespace,
          dryRun: options.dryRun,
        });
      } catch (err) {
        handleError(err);
      }
    });

  // ─── savestate memory log ───────────────────────────────────

  memory
    .command('log <memory-id>')
    .alias('history')
    .description('Show audit history for a memory')
    .option('--json', 'Output as JSON')
    .action(async (memoryId, options) => {
      try {
        const config = await loadConfig();
        const storage = await resolveStorage(config);
        const passphrase = await promptPassphrase();

        await memoryLogCommand(storage, passphrase, memoryId, {
          format: options.json ? 'json' : 'table',
        });
      } catch (err) {
        handleError(err);
      }
    });
}

// ─── Helpers ─────────────────────────────────────────────────

import { createInterface } from 'node:readline';

async function promptPassphrase(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    // Check for env var first
    const envPass = process.env.SAVESTATE_PASSPHRASE;
    if (envPass) {
      rl.close();
      resolve(envPass);
      return;
    }

    rl.question('Passphrase: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function handleError(err: unknown): void {
  if (err instanceof Error) {
    console.error(`Error: ${err.message}`);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
  } else {
    console.error('An unexpected error occurred');
  }
  process.exit(1);
}
