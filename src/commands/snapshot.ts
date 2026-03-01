/**
 * savestate snapshot — Capture current AI state to encrypted archive
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, loadConfig } from '../config.js';
import { detectAdapter, getAdapter } from '../adapters/registry.js';
import { createSnapshot } from '../snapshot.js';
import { resolveStorage } from '../storage/resolve.js';
import { getPassphrase } from '../passphrase.js';
import { loadIdentityFromFile } from '../identity/store.js';
import type { AgentIdentity } from '../identity/schema.js';

interface SnapshotOptions {
  label?: string;
  tags?: string;
  adapter?: string;
  schedule?: string;
  full?: boolean;
  identity?: string;
}

export async function snapshotCommand(options: SnapshotOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  if (options.schedule) {
    console.log(chalk.cyan(`⏰ To set up scheduled backups, use:`));
    console.log();
    console.log(`   savestate schedule --every ${options.schedule}`);
    console.log();
    console.log(chalk.dim('   This creates a system job (launchd/systemd) for reliable auto-backups.'));
    console.log();
    return;
  }

  const config = await loadConfig();

  try {
    // Resolve adapter
    let adapter;
    if (options.adapter) {
      adapter = getAdapter(options.adapter);
      if (!adapter) {
        console.log(chalk.red(`✗ Unknown adapter: ${options.adapter}`));
        process.exit(1);
      }
    } else if (config.defaultAdapter) {
      adapter = getAdapter(config.defaultAdapter);
    } else {
      adapter = await detectAdapter();
    }

    if (!adapter) {
      console.log(chalk.red('✗ No adapter found. Specify one with --adapter or configure a default.'));
      process.exit(1);
    }

    // Get passphrase
    const passphrase = await getPassphrase();

    // Resolve storage backend
    const storage = resolveStorage(config);

    // Load identity document if specified (Issue #92)
    let identity: AgentIdentity | undefined;
    if (options.identity) {
      identity = await loadIdentityFromFile(options.identity);
      if (!identity) {
        console.log(chalk.red(`✗ Identity file not found or invalid: ${options.identity}`));
        process.exit(1);
      }
    }

    const spinner = ora(`Extracting state via ${adapter.name} adapter...`).start();

    const result = await createSnapshot(adapter, storage, passphrase, {
      label: options.label,
      tags: options.tags?.split(',').map((t) => t.trim()),
      full: options.full,
      identity,
    });

    const typeLabel = result.incremental ? 'Incremental snapshot' : 'Full snapshot';
    spinner.succeed(`${typeLabel} created!`);
    console.log();
    console.log(`  ${chalk.dim('ID:')}         ${chalk.cyan(result.snapshot.manifest.id)}`);
    console.log(`  ${chalk.dim('Adapter:')}    ${adapter.name}`);
    console.log(`  ${chalk.dim('Type:')}       ${result.incremental ? chalk.yellow('incremental (delta)') : chalk.blue('full')}`);
    if (options.label) {
      console.log(`  ${chalk.dim('Label:')}      ${options.label}`);
    }
    if (identity) {
      console.log(`  ${chalk.dim('Identity:')}   ${chalk.green('✓')} ${identity.name} v${identity.version}`);
    }
    if (result.incremental && result.delta) {
      console.log(`  ${chalk.dim('Changes:')}    ${chalk.green(`+${result.delta.added}`)} added, ${chalk.yellow(`~${result.delta.modified}`)} modified, ${chalk.red(`-${result.delta.removed}`)} removed, ${chalk.dim(`${result.delta.unchanged} unchanged`)}`);
      console.log(`  ${chalk.dim('Chain:')}      depth ${result.delta.chainDepth} (parent: ${result.snapshot.manifest.parent})`);
      console.log(`  ${chalk.dim('Saved:')}      ${formatBytes(result.delta.bytesSaved)} vs full snapshot`);
    }
    console.log(`  ${chalk.dim('Files:')}      ${result.fileCount} files in archive`);
    console.log(`  ${chalk.dim('Archive:')}    ${formatBytes(result.archiveSize)}`);
    console.log(`  ${chalk.dim('Encrypted:')}  ${formatBytes(result.encryptedSize)}`);
    console.log(`  ${chalk.dim('Storage:')}    ${config.storage.type}`);
    console.log(`  ${chalk.dim('Status:')}     ${chalk.green('✓ Encrypted & stored')}`);
    console.log();
    console.log(chalk.dim(`  Restore with: savestate restore ${result.snapshot.manifest.id}`));
    console.log();

  } catch (err) {
    console.error();
    console.error(chalk.red('✗ Snapshot failed'));
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
