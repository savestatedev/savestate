/**
 * savestate search <query> — Search across snapshots
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, loadConfig } from '../config.js';
import { searchSnapshots } from '../search.js';
import { getPassphrase } from '../passphrase.js';
import type { SearchResult } from '../types.js';

interface SearchOptions {
  type?: string;
  limit?: string;
  snapshot?: string;
  json?: boolean;
}

const VALID_TYPES = new Set(['memory', 'conversation', 'identity', 'knowledge']);

export function formatSearchResultsJson(results: SearchResult[]): string {
  return JSON.stringify(results, null, 2);
}

export async function searchCommand(query: string, options: SearchOptions): Promise<void> {
  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const limit = options.limit ? parseInt(options.limit, 10) : 20;

  const types = options.type
    ? options.type
        .split(',')
        .map((t) => t.trim())
        .filter((t) => VALID_TYPES.has(t))
    : undefined;

  if (options.type && (!types || types.length === 0)) {
    console.log(chalk.red(`✗ Invalid --type. Use any of: ${[...VALID_TYPES].join(', ')}`));
    process.exit(1);
  }

  if (!options.json) {
    console.log(chalk.bold(`🔍 Searching: "${chalk.cyan(query)}"`));
    if (types) console.log(chalk.dim(`   Filter: ${types.join(', ')}`));
    if (options.snapshot) console.log(chalk.dim(`   Snapshot: ${options.snapshot}`));
    console.log();
  }

  const passphrase = await getPassphrase();

  const spinner = options.json ? null : ora('Searching across snapshots...').start();

  try {
    const results = await searchSnapshots(query, config, {
      types: types as ('memory' | 'conversation' | 'identity' | 'knowledge')[] | undefined,
      limit,
      snapshots: options.snapshot ? [options.snapshot] : undefined,
      passphrase,
    });

    spinner?.stop();

    if (options.json) {
      console.log(formatSearchResultsJson(results));
      return;
    }

    if (results.length === 0) {
      console.log(chalk.dim('  No matches found.'));
      console.log();
      return;
    }

    console.log(chalk.bold(`  ${results.length} result${results.length === 1 ? '' : 's'}:`));
    console.log();

    for (const r of results) {
      printResult(r);
    }
  } catch (err) {
    if (spinner) {
      spinner.fail('Search failed');
    }
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

function printResult(r: SearchResult): void {
  const ts = new Date(r.snapshotTimestamp).toISOString().slice(0, 10);
  const score = (r.score * 100).toFixed(0);
  console.log(
    `  ${chalk.cyan(r.snapshotId.slice(0, 14))} ${chalk.dim(ts)} ${chalk.yellow(r.type.padEnd(12))} ${chalk.dim(`(${score}%)`)}`,
  );
  if (r.context) console.log(`    ${chalk.dim(r.context)}`);
  console.log(`    ${chalk.dim(r.path)}`);
  console.log();
}
