/**
 * savestate search <query> — Search across snapshots
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, loadConfig } from '../config.js';
import { findEntry, loadIndex } from '../index-file.js';
import { searchSnapshots } from '../search.js';
import { getPassphrase } from '../passphrase.js';
import type { SearchResult } from '../types.js';

interface SearchOptions {
  type?: string;
  exclude?: string;
  limit?: string;
  snapshot?: string;
  adapter?: string;
  json?: boolean;
}

const SEARCH_TYPES = ['memory', 'conversation', 'identity', 'knowledge'] as const;
type SearchType = (typeof SEARCH_TYPES)[number];
const VALID_TYPES = new Set<string>(SEARCH_TYPES);
const MAX_SEARCH_LIMIT = 1000;
const SEARCH_TYPE_LIST = SEARCH_TYPES.join(', ');
const SEARCH_ADAPTERS = [
  'clawdbot',
  'claude-code',
  'claude-web',
  'openai-assistants',
  'chatgpt',
  'gemini',
  'cursor',
  'windsurf',
] as const;
const SEARCH_ADAPTER_LIST = SEARCH_ADAPTERS.join(', ');

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

/** Parse search --type without silently dropping unknown filters or exiting the process. */
export function parseSearchType(
  value: string | undefined,
): SearchType[] | undefined {
  if (value === undefined) return undefined;

  const types = value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  if (
    types.length === 0 ||
    types.some((token) => !VALID_TYPES.has(token))
  ) {
    throw new Error(
      `Invalid --type value "${value}". Expected one or more of: ${SEARCH_TYPE_LIST}.`,
    );
  }

  return types as SearchType[];
}

/** Parse search --exclude without silently skipping unknown types. */
export function parseSearchExclude(
  value: string | undefined,
): SearchType[] | undefined {
  if (value === undefined) return undefined;

  const types = value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  if (
    types.length === 0 ||
    types.some((token) => !VALID_TYPES.has(token))
  ) {
    throw new Error(
      `Invalid --exclude value "${value}". Expected one or more of: ${SEARCH_TYPE_LIST}.`,
    );
  }

  return types as SearchType[];
}

/** Resolve search --type/--exclude into the types that will be queried. */
export function resolveSearchType(
  options: Pick<SearchOptions, 'type' | 'exclude'>,
): SearchType[] | undefined {
  const include = parseSearchType(options.type);
  const exclude = parseSearchExclude(options.exclude);
  return exclude
    ? (include ?? [...SEARCH_TYPES]).filter((type) => !exclude.includes(type))
    : include;
}

/** Parse search --snapshot without treating blank ids as a missing snapshot. */
export function parseSearchSnapshot(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const snapshot = value.trim();
  if (snapshot.length === 0 || snapshot.includes(',') || /\s/.test(snapshot)) {
    throw new Error(
      `Invalid --snapshot value "${value}". Expected a single non-empty snapshot id.`,
    );
  }

  return snapshot;
}

/** Parse search --adapter without treating unknown ids as an empty result set. */
export function parseSearchAdapter(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const adapter = value.trim().toLowerCase();
  if ((SEARCH_ADAPTERS as readonly string[]).includes(adapter)) {
    return adapter;
  }

  throw new Error(
    `Invalid --adapter value "${value}". Expected one of: ${SEARCH_ADAPTER_LIST}.`,
  );
}

/** Parse search query without decrypting archives for blank input. */
export function parseSearchQuery(value: string | undefined): string {
  if (value === undefined) {
    throw new Error(
      'Invalid search query. Expected a non-empty query.',
    );
  }

  const query = value.trim();
  if (query.length === 0) {
    throw new Error(
      `Invalid search query "${value}". Expected a non-empty query.`,
    );
  }

  return query;
}

export async function searchCommand(rawQuery: string, options: SearchOptions): Promise<void> {
  const query = parseSearchQuery(rawQuery);
  const snapshotId = parseSearchSnapshot(options.snapshot);
  const adapter = parseSearchAdapter(options.adapter);

  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options.json) {
      console.log(formatSearchMissingJson(query, snapshotId ?? ''));
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const limit = parseSearchLimit(options.limit);
  const types = resolveSearchType(options);

  if (snapshotId) {
    const entry = await findEntry(snapshotId);
    if (!entry || (adapter && entry.adapter !== adapter)) {
      if (options.json) {
        console.log(formatSearchMissingJson(query, snapshotId));
        return;
      }
      console.log(chalk.red(`✗ Snapshot not found: ${snapshotId}`));
      process.exit(1);
    }
  }

  if (!options.json) {
    console.log(chalk.bold(`🔍 Searching: "${chalk.cyan(query)}"`));
    if (types) console.log(chalk.dim(`   Filter: ${types.join(', ')}`));
    if (snapshotId) console.log(chalk.dim(`   Snapshot: ${snapshotId}`));
    if (adapter) console.log(chalk.dim(`   Adapter: ${adapter}`));
    console.log();
  }

  const passphrase = await getPassphrase();

  const spinner = options.json ? null : ora('Searching across snapshots...').start();

  try {
    let snapshotIds: string[] | undefined;
    if (snapshotId) {
      snapshotIds = [snapshotId];
    } else if (adapter) {
      const index = await loadIndex();
      snapshotIds = index.snapshots
        .filter((entry) => entry.adapter === adapter)
        .map((entry) => entry.id);
    }

    const results = await searchSnapshots(query, config, {
      types,
      limit,
      snapshots: snapshotIds,
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
