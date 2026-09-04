/**
 * savestate restore [snapshot-id] — Restore from a snapshot
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, loadConfig } from '../config.js';
import { restoreSnapshot, type RestoreResult } from '../restore.js';
import { resolveStorage } from '../storage/resolve.js';
import { detectAdapter, getAdapter } from '../adapters/registry.js';
import { getPassphrase } from '../passphrase.js';

interface RestoreOptions {
  to?: string;
  dryRun?: boolean;
  include?: string;
  json?: boolean;
}

export function formatRestoreResultJson(result: RestoreResult, extra?: { dryRun?: boolean }): string {
  return JSON.stringify(
    {
      snapshotId: result.snapshotId,
      timestamp: result.timestamp,
      platform: result.platform,
      adapter: result.adapter,
      label: result.label ?? null,
      memoryCount: result.memoryCount,
      conversationCount: result.conversationCount,
      hasIdentity: result.hasIdentity,
      stateEventCount: result.stateEventCount,
      dryRun: extra?.dryRun ?? false,
    },
    null,
    2,
  );
}

export async function restoreCommand(snapshotId: string | undefined, options: RestoreOptions): Promise<void> {
  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const resolvedId = snapshotId ?? 'latest';
  const config = await loadConfig();

  if (!options.json) {
    console.log(chalk.bold(`🔄 Restoring from snapshot: ${chalk.cyan(resolvedId)}`));
    console.log();

    if (options.dryRun) {
      console.log(chalk.yellow('  ▸ DRY RUN — no changes will be made'));
      console.log();
    }
  }

  try {
    let adapter;
    if (options.to) {
      adapter = getAdapter(options.to);
      if (!adapter) {
        console.log(chalk.red(`✗ Unknown adapter: ${options.to}`));
        process.exit(1);
      }
    } else if (config.defaultAdapter) {
      adapter = getAdapter(config.defaultAdapter);
    } else {
      adapter = await detectAdapter();
    }

    if (!adapter) {
      console.log(chalk.red('✗ No adapter found. Specify one with --to or configure a default.'));
      process.exit(1);
    }

    const passphrase = await getPassphrase();
    const storage = resolveStorage(config);
    const spinner = options.json ? null : ora('Retrieving and decrypting snapshot...').start();

    const include = options.include
      ? (options.include.split(',').map((s) => s.trim()) as ('identity' | 'memory' | 'conversations')[])
      : undefined;

    const result = await restoreSnapshot(resolvedId, adapter, storage, passphrase, {
      include,
      dryRun: options.dryRun,
    });

    if (options.json) {
      console.log(formatRestoreResultJson(result, { dryRun: options.dryRun }));
      return;
    }

    spinner?.succeed('Restore complete!');
    console.log();
    console.log(`  ${chalk.dim('Snapshot:')}      ${chalk.cyan(result.snapshotId)}`);
    console.log(`  ${chalk.dim('Timestamp:')}     ${result.timestamp}`);
    console.log(`  ${chalk.dim('Platform:')}      ${result.platform}`);
    console.log(`  ${chalk.dim('Adapter:')}       ${result.adapter}`);
    if (result.label) {
      console.log(`  ${chalk.dim('Label:')}         ${result.label}`);
    }
    console.log(`  ${chalk.dim('Identity:')}      ${result.hasIdentity ? chalk.green('✓ restored') : chalk.dim('not present')}`);
    console.log(`  ${chalk.dim('Memory:')}        ${result.memoryCount} entries restored`);
    console.log(`  ${chalk.dim('Conversations:')} ${result.conversationCount} indexed`);
    console.log();

    if (options.dryRun) {
      console.log(chalk.yellow('  This was a dry run. No files were modified.'));
    } else {
      console.log(chalk.green('  ✓ Your AI state has been restored.'));
      console.log(chalk.dim('  Existing files were backed up with .bak extension.'));
    }
    console.log();

  } catch (err) {
    console.error();
    console.error(chalk.red('✗ Restore failed'));
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}
