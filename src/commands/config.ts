/**
 * savestate config — View/edit configuration
 */

import chalk from 'chalk';
import { isInitialized, loadConfig, localConfigPath } from '../config.js';

interface ConfigOptions {
  set?: string;
  json?: boolean;
}

export async function configCommand(options: ConfigOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const configPath = localConfigPath();

  if (options.set) {
    // TODO: Parse key=value and update config
    console.log(chalk.yellow(`  Setting config values is coming soon.`));
    console.log(chalk.dim(`  For now, edit directly: ${configPath}`));
    console.log();
    console.log(chalk.dim('  Usage examples:'));
    console.log(chalk.dim('    savestate config --set storage.type=s3'));
    console.log(chalk.dim('    savestate config --set defaultAdapter=chatgpt'));
    console.log(chalk.dim('    savestate config --set retention.maxSnapshots=50'));
    console.log();
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  console.log(chalk.bold('⚙️  SaveState Configuration'));
  console.log(chalk.dim(`   ${configPath}`));
  console.log();

  console.log(`  ${chalk.dim('Version:')}         ${config.version}`);
  console.log(`  ${chalk.dim('Storage:')}         ${config.storage.type}`);

  if (config.storage.options && Object.keys(config.storage.options).length > 0) {
    for (const [key, value] of Object.entries(config.storage.options)) {
      console.log(`  ${chalk.dim(`  ${key}:`)}       ${value}`);
    }
  }

  console.log(`  ${chalk.dim('Default Adapter:')} ${config.defaultAdapter ?? chalk.dim('(auto-detect)')}`);
  console.log(`  ${chalk.dim('Schedule:')}        ${config.schedule ?? chalk.dim('(manual)')}`);

  if (config.retention) {
    console.log(`  ${chalk.dim('Retention:')}`);
    if (config.retention.maxSnapshots) {
      console.log(`  ${chalk.dim('  Max snapshots:')} ${config.retention.maxSnapshots}`);
    }
    if (config.retention.maxAge) {
      console.log(`  ${chalk.dim('  Max age:')}       ${config.retention.maxAge}`);
    }
  }

  if (config.adapters.length > 0) {
    console.log(`  ${chalk.dim('Adapters:')}`);
    for (const adapter of config.adapters) {
      const status = adapter.enabled ? chalk.green('enabled') : chalk.red('disabled');
      console.log(`    • ${adapter.id} (${status})`);
    }
  }

  console.log();
}
