/**
 * savestate login — Authenticate with SaveState cloud
 */

import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, saveConfig, isInitialized } from '../config.js';

const API_BASE = 'https://savestate.dev/api';

interface LoginOptions {
  key?: string;
  json?: boolean;
}

export interface LoginResult {
  authenticated: boolean;
  email: string;
  tier: string;
  features: number;
  storageLimit: number;
}

export function formatLoginResultJson(result: LoginResult): string {
  return JSON.stringify(
    {
      authenticated: result.authenticated,
      email: result.email,
      tier: result.tier,
      features: result.features,
      storageLimit: result.storageLimit,
    },
    null,
    2,
  );
}

export async function loginCommand(options: LoginOptions): Promise<void> {
  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  let apiKey = options.key;

  // If no key provided, prompt for it
  if (!apiKey) {
    const readline = await import('node:readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    apiKey = await new Promise<string>((resolve) => {
      rl.question(chalk.dim('  API Key: '), (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  if (!apiKey || !apiKey.startsWith('ss_live_')) {
    console.log(chalk.red('✗ Invalid API key. Keys start with ss_live_'));
    console.log(chalk.dim('  Get your key at https://savestate.dev/account'));
    console.log();
    process.exit(1);
  }

  const spinner = options.json ? null : ora('Validating API key...').start();

  try {
    const res = await fetch(`${API_BASE}/account`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      spinner?.fail('Invalid API key');
      const body = await res.json().catch(() => ({}));
      console.log(chalk.red(`  ${(body as { error?: string }).error || 'Authentication failed'}`));
      console.log();
      process.exit(1);
    }

    const account = await res.json() as {
      email: string;
      tier: string;
      features: string[];
      storage: { limit: number };
    };

    const config = await loadConfig();
    const extConfig = config as unknown as Record<string, unknown>;
    extConfig.apiKey = apiKey;
    extConfig.account = {
      email: account.email,
      tier: account.tier,
    };
    await saveConfig(config);

    if (options.json) {
      console.log(
        formatLoginResultJson({
          authenticated: true,
          email: account.email,
          tier: account.tier,
          features: account.features?.length ?? 0,
          storageLimit: account.storage?.limit ?? 0,
        }),
      );
      return;
    }

    spinner?.succeed('Authenticated!');
    console.log();
    console.log(`  ${chalk.dim('Account:')}  ${chalk.cyan(account.email)}`);
    console.log(`  ${chalk.dim('Tier:')}     ${chalk.green(account.tier.toUpperCase())}`);
    console.log(`  ${chalk.dim('Features:')} ${account.features.length} enabled`);
    if (account.storage.limit > 0) {
      console.log(`  ${chalk.dim('Storage:')}  ${formatBytes(account.storage.limit)} cloud storage`);
    }
    console.log();
    console.log(chalk.dim('  Your API key is saved locally. Cloud features are now unlocked.'));
    console.log();

  } catch (err) {
    spinner?.fail('Connection failed');
    console.log(chalk.red(`  Could not reach ${API_BASE}`));
    console.log(chalk.dim('  Check your internet connection and try again.'));
    console.log();
    process.exit(1);
  }
}

interface LogoutOptions {
  json?: boolean;
}

export interface LogoutResult {
  loggedOut: boolean;
  hadKey: boolean;
}

export function formatLogoutResultJson(result: LogoutResult): string {
  return JSON.stringify(
    {
      loggedOut: result.loggedOut,
      hadKey: result.hadKey,
    },
    null,
    2,
  );
}

/**
 * savestate logout — Remove API key
 */
export async function logoutCommand(options: LogoutOptions = {}): Promise<void> {
  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const extConfig = config as unknown as Record<string, unknown>;
  const hadKey = !!extConfig.apiKey;

  delete extConfig.apiKey;
  delete extConfig.account;
  await saveConfig(config);

  if (options.json) {
    console.log(formatLogoutResultJson({ loggedOut: true, hadKey }));
    return;
  }

  if (hadKey) {
    console.log(chalk.green('  ✓ Logged out. API key removed.'));
  } else {
    console.log(chalk.dim('  Not logged in.'));
  }
  console.log();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
