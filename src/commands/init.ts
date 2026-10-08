/**
 * savestate init — Initialize SaveState in the current directory
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, initializeProject, loadConfig, localConfigDir, saveConfig } from '../config.js';
import { detectAdapter } from '../adapters/registry.js';
import { getPassphrase } from '../passphrase.js';

interface InitOptions {
  json?: boolean;
  limit?: string;
}

const MAX_INIT_LIMIT = 1000;

/** Parse init --limit without turning user input errors into an empty init. */
export function parseInitLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_INIT_LIMIT}.`,
    );
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_INIT_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_INIT_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N init status field rows when --limit is set. */
export function selectInitEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

export interface InitResult {
  initialized: boolean;
  alreadyInitialized: boolean;
  configDir: string;
  adapter: string | null;
  passphraseConfigured: boolean;
}

export function formatInitResultJson(result: InitResult): string {
  return JSON.stringify(
    {
      initialized: result.initialized,
      alreadyInitialized: result.alreadyInitialized,
      configDir: result.configDir,
      adapter: result.adapter,
      passphraseConfigured: result.passphraseConfigured,
    },
    null,
    2,
  );
}

function passphraseHint(config: { storage: { options: Record<string, unknown> } }): boolean {
  return Boolean(config.storage.options.passphraseConfigured) || Boolean(process.env.SAVESTATE_PASSPHRASE);
}

export async function initCommand(options: InitOptions = {}): Promise<void> {
  const limit = parseInitLimit(options.limit);

  if (!options.json) {
    console.log();
    console.log(chalk.bold('⚡ SaveState — Time Machine for AI'));
    console.log();
  }

  if (isInitialized()) {
    if (options.json) {
      const config = await loadConfig();
      console.log(
        formatInitResultJson({
          initialized: true,
          alreadyInitialized: true,
          configDir: localConfigDir(),
          adapter: config.defaultAdapter ?? null,
          passphraseConfigured: passphraseHint(config),
        }),
      );
      return;
    }
    const rows = [
      chalk.yellow('⚠  SaveState is already initialized in this directory.'),
      chalk.dim(`   Config: ${localConfigDir()}/config.json`),
    ];
    for (const row of selectInitEntries(rows, limit)) {
      console.log(row);
    }
    return;
  }

  const spinner = options.json ? null : ora('Initializing SaveState...').start();

  try {
    const config = await initializeProject();
    spinner?.succeed('Created .savestate/ directory');

    const detectSpinner = options.json ? null : ora('Detecting platform...').start();
    const adapter = await detectAdapter();

    if (adapter) {
      detectSpinner?.succeed(`Detected platform: ${chalk.cyan(adapter.name)}`);
      config.defaultAdapter = adapter.id;
      config.adapters.push({ id: adapter.id, enabled: true });
    } else {
      detectSpinner?.info('No platform auto-detected. Configure manually with `savestate config`.');
    }

    if (options.json) {
      if (process.env.SAVESTATE_PASSPHRASE) {
        config.storage.options.passphraseConfigured = true;
      }
    } else {
      console.log();
      console.log(chalk.dim('  Your snapshots will be encrypted with a passphrase.'));
      console.log(chalk.dim('  You can also set SAVESTATE_PASSPHRASE env var.'));
      console.log();

      try {
        const passphrase = await getPassphrase({ confirm: true });
        config.storage.options.passphraseConfigured = true;
        void passphrase;
      } catch (err) {
        if (process.env.SAVESTATE_PASSPHRASE) {
          console.log(chalk.green('  ✓ Using SAVESTATE_PASSPHRASE from environment'));
        } else {
          console.log(chalk.yellow('  ⚠ No passphrase set. You\'ll be prompted when creating snapshots.'));
        }
      }
    }

    await saveConfig(config);

    if (options.json) {
      console.log(
        formatInitResultJson({
          initialized: true,
          alreadyInitialized: false,
          configDir: localConfigDir(),
          adapter: config.defaultAdapter ?? null,
          passphraseConfigured: passphraseHint(config),
        }),
      );
      return;
    }

    console.log();
    console.log(chalk.green('✓ SaveState initialized!'));
    console.log();
    console.log(chalk.dim('  Next steps:'));
    const rows = [
      chalk.dim(`  ${chalk.white('savestate snapshot')}      Capture your first snapshot`),
      chalk.dim(`  ${chalk.white('savestate config')}        Configure storage & adapters`),
      chalk.dim(`  ${chalk.white('savestate adapters')}      See available platform adapters`),
    ];
    for (const row of selectInitEntries(rows, limit)) {
      console.log(row);
    }
    console.log();
  } catch (err) {
    spinner?.fail('Failed to initialize SaveState');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}
