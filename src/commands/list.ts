/**
 * savestate list — List all snapshots
 */

import chalk from 'chalk';
import { isInitialized, loadConfig } from '../config.js';

interface ListOptions {
  json?: boolean;
  limit?: string;
}

export async function listCommand(options: ListOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const _limit = options.limit ? parseInt(options.limit, 10) : 20;

  console.log(chalk.bold('📋 Snapshots'));
  console.log(chalk.dim(`   Storage: ${config.storage.type} (${JSON.stringify(config.storage.options)})`));
  console.log();

  // TODO: Actually list snapshots from storage
  // const backend = resolveStorageBackend(config);
  // const keys = await backend.list();

  console.log(chalk.dim('  No snapshots yet. Create one with:'));
  console.log();
  console.log(`    ${chalk.cyan('savestate snapshot')}`);
  console.log();
  console.log(chalk.dim('  Once you have snapshots, this will show:'));
  console.log(chalk.dim('  ┌────────────────────────────────┬────────────┬──────────┬──────────┐'));
  console.log(chalk.dim('  │ ID                             │ Date       │ Adapter  │ Size     │'));
  console.log(chalk.dim('  ├────────────────────────────────┼────────────┼──────────┼──────────┤'));
  console.log(chalk.dim('  │ ss-2026-01-27T15-00-00-a3f2   │ Jan 27     │ clawdbot │ 142 KB   │'));
  console.log(chalk.dim('  │ ss-2026-01-26T09-30-00-b1c8   │ Jan 26     │ clawdbot │ 12 KB ∆  │'));
  console.log(chalk.dim('  └────────────────────────────────┴────────────┴──────────┴──────────┘'));
  console.log();

  if (options.json) {
    console.log(chalk.dim('  (--json flag will output machine-readable JSON)'));
  }
}
