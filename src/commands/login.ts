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
  limit?: string;
  offset?: string;
}

const MAX_LOGIN_LIMIT = 1000;
const MAX_LOGIN_OFFSET = 1000;

/** Parse login --limit without turning user input errors into an empty login. */
export function parseLoginLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_LOGIN_LIMIT}.`,
    );
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LOGIN_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_LOGIN_LIMIT}.`,
    );
  }
  return limit;
}

/** Parse login --offset without turning user input errors into an unbounded skip. */
export function parseLoginOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_LOGIN_OFFSET}.`,
    );
  }

  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_LOGIN_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_LOGIN_OFFSET}.`,
    );
  }
  return offset;
}

/** Apply login status pagination in offset-then-limit order. */
export function selectLoginEntries<T>(entries: T[], limit?: number, offset?: number): T[] {
  return entries.slice(offset ?? 0, (offset ?? 0) + (limit ?? entries.length));
}

/** Parse login --key without treating blank or comma-separated values as an API key. */
export function parseLoginKey(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const key = value.trim();
  if (key.length === 0 || key.includes(',') || /\s/.test(key)) {
    throw new Error(
      `Invalid --key value "${value}". Expected a single non-empty API key.`,
    );
  }

  return key;
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

export interface LoginMissingJson {
  found: false;
  authenticated: false;
  email: null;
  tier: null;
}

export function formatLoginMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      authenticated: false,
      email: null,
      tier: null,
    },
    null,
    2,
  );
}

export async function loginCommand(options: LoginOptions): Promise<void> {
  const limit = parseLoginLimit(options.limit);
  const offset = parseLoginOffset(options.offset);

  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options.json) {
      console.log(formatLoginMissingJson());
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  let apiKey = parseLoginKey(options.key);

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
    const rows = [
      `  ${chalk.dim('Account:')}  ${chalk.cyan(account.email)}`,
      `  ${chalk.dim('Tier:')}     ${chalk.green(account.tier.toUpperCase())}`,
      `  ${chalk.dim('Features:')} ${account.features.length} enabled`,
    ];
    if (account.storage.limit > 0) {
      rows.push(`  ${chalk.dim('Storage:')}  ${formatBytes(account.storage.limit)} cloud storage`);
    }
    for (const row of selectLoginEntries(rows, limit, offset)) {
      console.log(row);
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
  limit?: string;
  offset?: string;
}

const MAX_LOGOUT_LIMIT = 1000;
const MAX_LOGOUT_OFFSET = 1000;

/** Parse logout --limit without turning user input errors into an empty logout. */
export function parseLogoutLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_LOGOUT_LIMIT}.`,
    );
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LOGOUT_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_LOGOUT_LIMIT}.`,
    );
  }
  return limit;
}

/** Parse logout --offset without turning user input errors into an unbounded skip. */
export function parseLogoutOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_LOGOUT_OFFSET}.`,
    );
  }

  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_LOGOUT_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_LOGOUT_OFFSET}.`,
    );
  }
  return offset;
}

/** Apply logout status pagination in offset-then-limit order. */
export function selectLogoutEntries<T>(entries: T[], limit?: number, offset?: number): T[] {
  return entries.slice(offset ?? 0, (offset ?? 0) + (limit ?? entries.length));
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

export interface LogoutMissingJson {
  found: false;
  loggedOut: false;
  hadKey: false;
}

export function formatLogoutMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      loggedOut: false,
      hadKey: false,
    },
    null,
    2,
  );
}

/**
 * savestate logout — Remove API key
 */
export async function logoutCommand(options: LogoutOptions = {}): Promise<void> {
  const limit = parseLogoutLimit(options.limit);
  const offset = parseLogoutOffset(options.offset);

  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options.json) {
      console.log(formatLogoutMissingJson());
      return;
    }
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

  const rows = hadKey
    ? [
        `  ${chalk.dim('Status:')}   ${chalk.green('Logged out')}`,
        `  ${chalk.dim('API key:')}  removed`,
        `  ${chalk.dim('Account:')}  cleared`,
      ]
    : [
        `  ${chalk.dim('Status:')}   Not logged in`,
        `  ${chalk.dim('API key:')}  none`,
        `  ${chalk.dim('Account:')}  none`,
      ];
  for (const row of selectLogoutEntries(rows, limit, offset)) {
    console.log(row);
  }
  console.log();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
