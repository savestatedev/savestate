/**
 * savestate init — Initialize SaveState in the current directory
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, initializeProject, localConfigDir } from '../config.js';
import { detectAdapter } from '../adapters/registry.js';

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
