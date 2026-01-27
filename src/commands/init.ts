/**
 * savestate init — Initialize SaveState in the current directory
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, initializeProject, localConfigDir, saveConfig } from '../config.js';
import { detectAdapter } from '../adapters/registry.js';
import { getPassphrase } from '../passphrase.js';

export async function initCommand(): Promise<void> {
  console.log();
  console.log(chalk.bold('⚡ SaveState — Time Machine for AI'));
  console.log();

  if (isInitialized()) {
    console.log(chalk.yellow('⚠  SaveState is already initialized in this directory.'));
    console.log(chalk.dim(`   Config: ${localConfigDir()}/config.json`));
    return;
  }

  const spinner = ora('Initializing SaveState...').start();

  try {
    const config = await initializeProject();
    spinner.succeed('Created .savestate/ directory');

    // Try to auto-detect the platform
    const detectSpinner = ora('Detecting platform...').start();
    const adapter = await detectAdapter();

    if (adapter) {
      detectSpinner.succeed(`Detected platform: ${chalk.cyan(adapter.name)}`);
      config.defaultAdapter = adapter.id;
      config.adapters.push({ id: adapter.id, enabled: true });
    } else {
      detectSpinner.info('No platform auto-detected. Configure manually with `savestate config`.');
    }

    // Prompt for passphrase
    console.log();
    console.log(chalk.dim('  Your snapshots will be encrypted with a passphrase.'));
    console.log(chalk.dim('  You can also set SAVESTATE_PASSPHRASE env var.'));
    console.log();

    try {
      const passphrase = await getPassphrase({ confirm: true });
      // Store a hint that passphrase was set (but NOT the passphrase itself)
      config.storage.options.passphraseConfigured = true;
      void passphrase; // We don't store it — just validate it works
    } catch (err) {
      // If non-interactive (e.g., env var set), that's fine
      // If truly no passphrase, warn but don't block init
      if (process.env.SAVESTATE_PASSPHRASE) {
        console.log(chalk.green('  ✓ Using SAVESTATE_PASSPHRASE from environment'));
      } else {
        console.log(chalk.yellow('  ⚠ No passphrase set. You\'ll be prompted when creating snapshots.'));
      }
    }

    // Save updated config
    await saveConfig(config);

    console.log();
    console.log(chalk.green('✓ SaveState initialized!'));
    console.log();
    console.log(chalk.dim('  Next steps:'));
    console.log(chalk.dim(`  ${chalk.white('savestate snapshot')}      Capture your first snapshot`));
    console.log(chalk.dim(`  ${chalk.white('savestate config')}        Configure storage & adapters`));
    console.log(chalk.dim(`  ${chalk.white('savestate adapters')}      See available platform adapters`));
    console.log();
  } catch (err) {
    spinner.fail('Failed to initialize SaveState');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}
