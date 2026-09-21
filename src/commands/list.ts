/**
 * savestate list — List all snapshots
 */

import chalk from 'chalk';
import { isInitialized, loadConfig } from '../config.js';
import { loadIndex, type SnapshotIndexEntry } from '../index-file.js';

interface ListOptions {
  json?: boolean;
  limit?: string;
  since?: string;
  until?: string;
  adapter?: string;
  exclude?: string;
  snapshot?: string;
  tag?: string;
}

const MAX_LIST_LIMIT = 1000;
const LIST_ADAPTERS = [
  'clawdbot',
  'claude-code',
  'claude-web',
  'openai-assistants',
  'chatgpt',
  'gemini',
  'cursor',
  'windsurf',
] as const;
const LIST_ADAPTER_LIST = LIST_ADAPTERS.join(', ');

export interface ListSnapshotJson {
  id: string;
  timestamp: string;
  platform: string;
  adapter: string;
  label: string | null;
  tags: string[];
  filename: string;
  size: number;
}

export function formatListJson(snapshots: SnapshotIndexEntry[], limit = 50): string {
  const records: ListSnapshotJson[] = [...snapshots]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit)
    .map((snapshot) => ({
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      platform: snapshot.platform,
      adapter: snapshot.adapter,
      label: snapshot.label ?? null,
      tags: snapshot.tags ?? [],
      filename: snapshot.filename,
      size: snapshot.size,
    }));
  return JSON.stringify(records, null, 2);
}

export interface ListMissingJson {
  found: false;
  total: 0;
  storage: null;
}

export function formatListMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      total: 0,
      storage: null,
    },
    null,
    2,
  );
}

/** Parse a snapshot-list limit without turning user input errors into empty output. */
export function parseListLimit(value: string | undefined): number {
  if (value === undefined) return 50;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_LIST_LIMIT}.`,
    );
  }
  return limit;
}

/** Parse list --since without treating invalid dates as an empty snapshot list. */
export function parseListSince(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) throw new Error(`Invalid --since value "${value}". Expected an ISO 8601 date.`);
  return ms;
}

/** Parse list --until without treating invalid dates as an empty snapshot list. */
export function parseListUntil(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid --until value "${value}". Expected an ISO 8601 date.`,
    );
  }
  return ms;
}

/** Parse list --adapter without treating unknown ids as an empty snapshot list. */
export function parseListAdapter(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const adapter = value.trim().toLowerCase();
  if ((LIST_ADAPTERS as readonly string[]).includes(adapter)) {
    return adapter;
  }

  throw new Error(
    `Invalid --adapter value "${value}". Expected one of: ${LIST_ADAPTER_LIST}.`,
  );
}

/** Parse list --exclude without treating unknown ids as an empty snapshot list. */
export function parseListExclude(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;

  const adapters = value
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (
    adapters.length === 0 ||
    adapters.some((adapter) => !(LIST_ADAPTERS as readonly string[]).includes(adapter))
  ) {
    throw new Error(
      `Invalid --exclude value "${value}". Expected one or more of: ${LIST_ADAPTER_LIST}.`,
    );
  }

  return adapters;
}

/** Parse list --snapshot without treating blank ids as an empty snapshot list. */
export function parseListSnapshot(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const snapshot = value.trim();
  if (snapshot.length === 0 || snapshot.includes(',') || /\s/.test(snapshot)) {
    throw new Error(
      `Invalid --snapshot value "${value}". Expected a single non-empty snapshot id.`,
    );
  }

  return snapshot;
}

/** Parse list --tag without treating blank or comma-separated values as an empty snapshot list. */
export function parseListTag(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const tag = value.trim();
  if (tag.length === 0 || tag.includes(',')) {
    throw new Error(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  }

  return tag;
}

export async function listCommand(options: ListOptions): Promise<void> {
  parseListAdapter(options.adapter);
  parseListExclude(options.exclude);
  parseListSnapshot(options.snapshot);
  parseListTag(options.tag);

  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options.json) {
      console.log(formatListMissingJson());
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const limit = parseListLimit(options.limit);
  const index = await loadIndex();

  const filtered = applyListFilters(index.snapshots, options);

  if (options.json) {
    console.log(formatListJson(filtered, limit));
    return;
  }

  console.log(chalk.bold('📋 Snapshots'));
  console.log(chalk.dim(`   Storage: ${config.storage.type}`));
  console.log();

  if (index.snapshots.length === 0) {
    console.log(chalk.dim('  No snapshots yet. Create one with:'));
    console.log();
    console.log(`    ${chalk.cyan('savestate snapshot')}`);
    console.log();
    return;
  }

  if (filtered.length === 0) {
    console.log(chalk.dim('  No snapshots match those filters.'));
    console.log();
    return;
  }

  // Sort by timestamp descending (most recent first)
  const sorted = [...filtered]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  // Calculate column widths
  const idWidth = Math.max(10, ...sorted.map((s) => s.id.length));
  const dateWidth = 20;
  const adapterWidth = Math.max(7, ...sorted.map((s) => s.adapter.length));
  const labelWidth = Math.max(5, ...sorted.map((s) => (s.label ?? '').length));
  const sizeWidth = 10;

  // Header
  const header = [
    'ID'.padEnd(idWidth),
    'Date'.padEnd(dateWidth),
    'Adapter'.padEnd(adapterWidth),
    'Label'.padEnd(labelWidth),
    'Size'.padStart(sizeWidth),
  ].join('  ');

  console.log(chalk.dim(`  ${header}`));
  console.log(chalk.dim(`  ${'─'.repeat(header.length)}`));

  // Rows
  for (const s of sorted) {
    const date = formatDate(s.timestamp);
    const label = s.label ?? chalk.dim('—');
    const size = formatBytes(s.size);

    const row = [
      chalk.cyan(s.id.padEnd(idWidth)),
      date.padEnd(dateWidth),
      s.adapter.padEnd(adapterWidth),
      (typeof label === 'string' ? label : label).toString().padEnd(labelWidth),
      size.padStart(sizeWidth),
    ].join('  ');

    console.log(`  ${row}`);
  }

  console.log();
  console.log(chalk.dim(`  ${sorted.length} snapshot${sorted.length !== 1 ? 's' : ''}`));
  if (filtered.length > limit) {
    console.log(chalk.dim(`  (showing ${limit} of ${filtered.length} after filters)`));
  } else if (filtered.length !== index.snapshots.length) {
    console.log(chalk.dim(`  (filtered from ${index.snapshots.length} total)`));
  }
  console.log();
}

export function applyListFilters(
  snapshots: SnapshotIndexEntry[],
  options: { since?: string; until?: string; adapter?: string; exclude?: string; snapshot?: string; tag?: string },
): SnapshotIndexEntry[] {
  const since = parseListSince(options.since);
  const until = parseListUntil(options.until);
  const adapter = parseListAdapter(options.adapter);
  const exclude = parseListExclude(options.exclude);
  const snapshotId = parseListSnapshot(options.snapshot);
  const tag = parseListTag(options.tag);

  return snapshots.filter((s) => {
    const ts = new Date(s.timestamp).getTime();
    if (since !== undefined && ts < since) return false;
    if (until !== undefined && ts > until) return false;
    if (adapter && s.adapter !== adapter) return false;
    if (exclude !== undefined && exclude.includes(s.adapter)) return false;
    if (snapshotId !== undefined && s.id !== snapshotId) return false;
    if (tag && !(s.tags ?? []).includes(tag)) return false;
    return true;
  });
}

function parseDateOrThrow(input: string, flag: string): number {
  const ms = new Date(input).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid date for ${flag}: ${input} (use ISO format like 2026-04-01)`);
  }
  return ms;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
