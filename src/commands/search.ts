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
  since?: string;
  until?: string;
  limit?: string;
  offset?: string;
  snapshot?: string;
  adapter?: string;
  tag?: string;
  label?: string;
  json?: boolean;
  jsonSummary?: boolean;
}

const SEARCH_TYPES = ['memory', 'conversation', 'identity', 'knowledge'] as const;
type SearchType = (typeof SEARCH_TYPES)[number];
const VALID_TYPES = new Set<string>(SEARCH_TYPES);
const MAX_SEARCH_LIMIT = 1000;
const MAX_SEARCH_OFFSET = 1000;
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

export interface SearchSummaryPagination {
  offset: number;
  limit: number;
  shown: number;
  emptyReason: 'collection' | 'page' | null;
  suggestedOffset: number | null;
  hasMore: boolean;
  nextOffset: number | null;
  hasPrevious: boolean;
  previousOffset: number | null;
}

export interface SearchSummaryFilters {
  type: SearchType[] | null;
  exclude: SearchType[] | null;
  since: string | null;
  until: string | null;
  snapshot: string | null;
  adapter: string | null;
  tag: string | null;
  label: string | null;
}

export interface SearchSummaryJson {
  found: boolean;
  query: string;
  filters: SearchSummaryFilters;
  results: SearchResult[];
  pagination: SearchSummaryPagination;
}

/** Keep paginated search navigation machine-readable without changing --json arrays. */
export function formatSearchResultsSummaryJson(input: {
  query: string;
  results: SearchResult[];
  offset?: number;
  limit?: number;
  filters?: Partial<SearchSummaryFilters>;
}): string {
  const offset = input.offset ?? 0;
  const limit = input.limit ?? 20;
  const shown = input.results.length;
  const hasMore = shown === limit && offset < MAX_SEARCH_OFFSET;
  const suggestedOffset = shown === 0 && offset > 0
    ? Math.max(0, offset - limit)
    : null;
  return JSON.stringify(
    {
      found: true,
      query: input.query,
      filters: {
        type: input.filters?.type ?? null,
        exclude: input.filters?.exclude ?? null,
        since: input.filters?.since?.trim() ?? null,
        until: input.filters?.until?.trim() ?? null,
        snapshot: input.filters?.snapshot?.trim() ?? null,
        adapter: input.filters?.adapter?.trim().toLowerCase() ?? null,
        tag: input.filters?.tag?.trim() ?? null,
        label: input.filters?.label?.trim() ?? null,
      },
      results: input.results,
      pagination: {
        offset,
        limit,
        shown,
        emptyReason: shown === 0 ? (offset > 0 ? 'page' : 'collection') : null,
        suggestedOffset,
        hasMore,
        nextOffset: hasMore
          ? Math.min(MAX_SEARCH_OFFSET, offset + shown)
          : null,
        hasPrevious: offset > 0,
        previousOffset: offset > 0 ? Math.max(0, offset - limit) : null,
      },
    } satisfies SearchSummaryJson,
    null,
    2,
  );
}

/** Explain how to continue or recover from a paginated interactive search. */
export function formatSearchPageHint(
  shown: number,
  offset = 0,
  limit = 20,
): string | undefined {
  if (shown === 0 && offset > 0) {
    return `No matches found at offset ${offset}. Try --offset ${Math.max(0, offset - limit)} --limit ${limit}.`;
  }
  if (shown === limit) {
    if (offset >= MAX_SEARCH_OFFSET) {
      return `Reached maximum searchable offset ${MAX_SEARCH_OFFSET}; no later page is available.`;
    }

    const nextOffset = offset + shown;
    if (nextOffset > MAX_SEARCH_OFFSET) {
      return `More matches may be available; try --offset ${MAX_SEARCH_OFFSET} --limit ${limit} (maximum).`;
    }

    return `More matches may be available; try --offset ${nextOffset} --limit ${limit}.`;
  }
  return undefined;
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

export function formatSearchMissingSummaryJson(
  query: string,
  snapshot: string,
  offset = 0,
  limit = 20,
): string {
  return JSON.stringify(
    {
      found: false,
      query,
      snapshot,
      results: [],
      pagination: {
        offset,
        limit,
        shown: 0,
        emptyReason: 'collection',
        suggestedOffset: null,
        hasMore: false,
        nextOffset: null,
        hasPrevious: offset > 0,
        previousOffset: offset > 0 ? Math.max(0, offset - limit) : null,
      },
    },
    null,
    2,
  );
}

/** Parse a search result limit without turning user input errors into empty output. */
export function parseSearchLimit(value: string | undefined): number {
  if (value === undefined) return 20;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_SEARCH_LIMIT}.`,
    );
  }

  const limit = Number(normalized);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_SEARCH_LIMIT}.`,
    );
  }
  return limit;
}

/** Parse search --offset without turning user input errors into an unbounded skip. */
export function parseSearchOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_SEARCH_OFFSET}.`,
    );
  }

  const offset = Number(normalized);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_SEARCH_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_SEARCH_OFFSET}.`,
    );
  }
  return offset;
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

/** Parse search --since without treating invalid dates as an empty result set. */
export function parseSearchSince(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid --since value "${value}". Expected an ISO 8601 date.`,
    );
  }
  return ms;
}

/** Parse search --until without treating invalid dates as an empty result set. */
export function parseSearchUntil(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  // Date-only input is a human-facing calendar boundary. Include the full
  // UTC day, matching snapshot list filtering and avoiding a surprising
  // midnight cutoff for `search --until 2026-10-12`.
  const normalized = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  let ms: number;
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const endOfDay = new Date(`${normalized}T23:59:59.999Z`);
    // Date parsing normalizes impossible dates (e.g. 2026-02-30) instead of
    // rejecting them, so round-trip the calendar components before accepting.
    const isValidCalendarDate =
      endOfDay.getUTCFullYear() === Number(year) &&
      endOfDay.getUTCMonth() + 1 === Number(month) &&
      endOfDay.getUTCDate() === Number(day);
    ms = isValidCalendarDate ? endOfDay.getTime() : Number.NaN;
  } else {
    ms = new Date(value).getTime();
  }
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid --until value "${value}". Expected an ISO 8601 date.`,
    );
  }
  return ms;
}

/** Reject an inverted search date range before it can look like an empty result. */
export function validateSearchDateRange(
  since: number | undefined,
  until: number | undefined,
  rawSince?: string,
  rawUntil?: string,
): void {
  if (since !== undefined && until !== undefined && since > until) {
    throw new Error(
      `Invalid search date range: --since (${rawSince ?? new Date(since).toISOString()}) must be on or before --until (${rawUntil ?? new Date(until).toISOString()}).`,
    );
  }
}

/** Parse search --tag without treating blank or comma-separated values as an empty result set. */
export function parseSearchTag(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const tag = value.trim();
  if (tag.length === 0 || tag.includes(',')) {
    throw new Error(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  }

  return tag;
}

/** Parse search --label without treating blank or comma-separated values as an empty result set. */
export function parseSearchLabel(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const label = value.trim();
  if (label.length === 0 || label.includes(',')) {
    throw new Error(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  }

  return label;
}

/** Resolve snapshot filters into ids before decrypting archives. */
export function resolveSearchSnapshots(
  snapshots: Array<{ id: string; timestamp: string; adapter?: string; tags?: string[]; label?: string }>,
  options: Pick<SearchOptions, 'snapshot' | 'since' | 'until' | 'adapter' | 'tag' | 'label'>,
): string[] | undefined {
  const snapshotId = parseSearchSnapshot(options.snapshot);
  const since = parseSearchSince(options.since);
  const until = parseSearchUntil(options.until);
  validateSearchDateRange(since, until, options.since, options.until);
  const adapter = parseSearchAdapter(options.adapter);
  const tag = parseSearchTag(options.tag);
  const label = parseSearchLabel(options.label);
  if (
    snapshotId === undefined &&
    since === undefined &&
    until === undefined &&
    adapter === undefined &&
    tag === undefined &&
    label === undefined
  ) {
    return undefined;
  }

  return snapshots
    .filter((entry) => {
      if (snapshotId !== undefined && entry.id !== snapshotId) return false;
      if (since !== undefined && new Date(entry.timestamp).getTime() < since) {
        return false;
      }
      if (until !== undefined && new Date(entry.timestamp).getTime() > until) {
        return false;
      }
      if (adapter !== undefined && entry.adapter !== adapter) return false;
      if (tag !== undefined && !(entry.tags ?? []).includes(tag)) return false;
      if (label !== undefined && entry.label !== label) return false;
      return true;
    })
    .map((entry) => entry.id);
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
  const since = parseSearchSince(options.since);
  const until = parseSearchUntil(options.until);
  const tag = parseSearchTag(options.tag);
  const label = parseSearchLabel(options.label);

  const jsonOutput = options.json || options.jsonSummary;

  if (!jsonOutput) {
    console.log();
  }

  if (!isInitialized()) {
    if (jsonOutput) {
      const limit = parseSearchLimit(options.limit);
      const offset = parseSearchOffset(options.offset) ?? 0;
      console.log(options.jsonSummary
        ? formatSearchMissingSummaryJson(query, snapshotId ?? '', offset, limit)
        : formatSearchMissingJson(query, snapshotId ?? ''));
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const limit = parseSearchLimit(options.limit);
  const offset = parseSearchOffset(options.offset);
  const types = resolveSearchType(options);
  const excludedTypes = parseSearchExclude(options.exclude);

  let catalog: Array<{ id: string; timestamp: string }> | undefined;
  if (snapshotId) {
    const entry = await findEntry(snapshotId);
    if (!entry || (adapter && entry.adapter !== adapter)) {
      if (jsonOutput) {
        const limit = parseSearchLimit(options.limit);
        const offset = parseSearchOffset(options.offset) ?? 0;
        console.log(options.jsonSummary
          ? formatSearchMissingSummaryJson(query, snapshotId, offset, limit)
          : formatSearchMissingJson(query, snapshotId));
        return;
      }
      console.log(chalk.red(`✗ Snapshot not found: ${snapshotId}`));
      process.exit(1);
    }
    catalog = [entry];
  } else if (since !== undefined || until !== undefined || adapter || tag || label) {
    catalog = (await loadIndex()).snapshots;
  }

  const snapshots = catalog
    ? resolveSearchSnapshots(catalog, options)
    : undefined;

  if (!options.json) {
    console.log(chalk.bold(`🔍 Searching: "${chalk.cyan(query)}"`));
    if (types) console.log(chalk.dim(`   Filter: ${types.join(', ')}`));
    if (since !== undefined) console.log(chalk.dim(`   Since: ${options.since}`));
    if (until !== undefined) console.log(chalk.dim(`   Until: ${options.until}`));
    if (snapshotId) console.log(chalk.dim(`   Snapshot: ${snapshotId}`));
    if (adapter) console.log(chalk.dim(`   Adapter: ${adapter}`));
    if (tag) console.log(chalk.dim(`   Tag: ${tag}`));
    if (label) console.log(chalk.dim(`   Label: ${label}`));
    if (offset !== undefined) console.log(chalk.dim(`   Offset: ${offset}`));
    console.log();
  }

  const passphrase = await getPassphrase();

  const spinner = jsonOutput ? null : ora('Searching across snapshots...').start();

  try {
    const results = await searchSnapshots(query, config, {
      types,
      limit,
      offset,
      snapshots,
      passphrase,
    });

    spinner?.stop();

    if (jsonOutput) {
      console.log(options.jsonSummary
        ? formatSearchResultsSummaryJson({
          query,
          results,
          offset,
          limit,
          filters: {
            type: types ?? null,
            exclude: excludedTypes ?? null,
            since: options.since,
            until: options.until,
            snapshot: snapshotId,
            adapter,
            tag,
            label,
          },
        })
        : formatSearchResultsJson(results));
      return;
    }

    if (results.length === 0) {
      const hint = formatSearchPageHint(results.length, offset, limit);
      console.log(chalk.dim(`  ${hint ?? 'No matches found.'}`));
      console.log();
      return;
    }

    console.log(chalk.bold(`  ${results.length} result${results.length === 1 ? '' : 's'}:`));
    console.log();

    for (const r of results) {
      printResult(r);
    }

    const hint = formatSearchPageHint(results.length, offset, limit);
    if (hint) {
      console.log(chalk.dim(`  ${hint}`));
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
