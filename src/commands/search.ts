/**
 * savestate search <query> — Search across snapshots
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, loadConfig } from '../config.js';
import { findEntry } from '../index-file.js';
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
const MAX_SEARCH_LIMIT = 1000;

export function formatSearchResultsJson(results: SearchResult[]): string {
  return JSON.stringify(results, null, 2);
}

export interface SearchMissingJson {
  found: false;
  query: string;
  snapshot: string;
  count: 0;
}

export function formatSearchMissingJson(query: string, snapshot: string): string {
  return JSON.stringify(
    {
      found: false,
      query,
      snapshot,
      count: 0,
    },
    null,
    2,
  );
}

/** Parse a search result limit without turning user input errors into empty output. */
export function parseSearchLimit(value: string | undefined): number {
  if (value === undefined) return 20;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_SEARCH_LIMIT}.`,
    );
  }
  return limit;
}

export async function searchCommand(query: string, options: SearchOptions): Promise<void> {
  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options.json) {
      console.log(formatSearchMissingJson(query, options.snapshot ?? ''));
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const limit = parseSearchLimit(options.limit);

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

  if (options.snapshot) {
    const entry = await findEntry(options.snapshot);
    if (!entry) {
      if (options.json) {
        console.log(formatSearchMissingJson(query, options.snapshot));
        return;
      }
      console.log(chalk.red(`✗ Snapshot not found: ${options.snapshot}`));
      process.exit(1);
    }
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
