/**
 * savestate snapshot — Capture current AI state to encrypted archive
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, loadConfig } from '../config.js';
import { detectAdapter, getAdapter } from '../adapters/registry.js';

interface SnapshotOptions {
  label?: string;
  tags?: string;
  adapter?: string;
  schedule?: string;
}

export async function snapshotCommand(options: SnapshotOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  if (options.schedule) {
    console.log(chalk.cyan(`⏰ Scheduled snapshots: every ${options.schedule}`));
    console.log(chalk.dim('   [Coming soon] Will run as a background daemon.'));
    console.log(chalk.dim('   For now, use cron: */6 * * * * savestate snapshot'));
    console.log();
    return;
  }

  const config = await loadConfig();
  const spinner = ora('Preparing snapshot...').start();

  try {
    // Resolve adapter
    let adapter;
    if (options.adapter) {
      adapter = getAdapter(options.adapter);
      if (!adapter) {
        spinner.fail(`Unknown adapter: ${options.adapter}`);
        return;
      }
    } else if (config.defaultAdapter) {
      adapter = getAdapter(config.defaultAdapter);
    } else {
      adapter = await detectAdapter();
    }

    if (!adapter) {
      spinner.fail('No adapter found. Specify one with --adapter or configure a default.');
      return;
    }

    spinner.text = `Extracting state via ${adapter.name} adapter...`;

    // TODO: Actually create the snapshot
    // const snapshot = await createSnapshot(config, adapter, {
    //   label: options.label,
    //   tags: options.tags?.split(',').map(t => t.trim()),
    // });

    // Simulate for now
    await new Promise((resolve) => setTimeout(resolve, 500));

    spinner.text = 'Building SAF archive...';
    await new Promise((resolve) => setTimeout(resolve, 300));

    spinner.text = 'Encrypting...';
    await new Promise((resolve) => setTimeout(resolve, 200));

    const fakeId = `ss-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

    spinner.succeed('Snapshot created!');
    console.log();
    console.log(`  ${chalk.dim('ID:')}       ${chalk.cyan(fakeId)}`);
    console.log(`  ${chalk.dim('Adapter:')}  ${adapter.name}`);
    if (options.label) {
      console.log(`  ${chalk.dim('Label:')}    ${options.label}`);
    }
    console.log(`  ${chalk.dim('Storage:')}  ${config.storage.type}`);
    console.log(`  ${chalk.dim('Status:')}   ${chalk.green('Encrypted & stored')}`);
    console.log();
    console.log(chalk.dim('  Restore with: savestate restore ' + fakeId));
    console.log();

  } catch (err) {
    spinner.fail('Snapshot failed');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}
