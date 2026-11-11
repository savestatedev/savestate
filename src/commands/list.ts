/**
 * savestate list — List all snapshots
 */

import chalk from 'chalk';
import { isInitialized, loadConfig } from '../config.js';
import { loadIndex, type SnapshotIndexEntry } from '../index-file.js';

interface ListOptions {
  json?: boolean;
  jsonSummary?: boolean;
  oldestFirst?: boolean;
  reverse?: boolean;
  limit?: string;
  offset?: string;
  since?: string;
  until?: string;
  platform?: string;
  adapter?: string;
  exclude?: string;
  snapshot?: string;
  tag?: string;
  label?: string;
}

const MAX_LIST_LIMIT = 1000;
const MAX_LIST_OFFSET = 1000;
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

export interface ListJsonFilters {
  since: string | null;
  until: string | null;
  platform: string | null;
  adapter: string | null;
  exclude: string[];
  snapshot: string | null;
  tag: string | null;
  label: string | null;
}

export interface ListJson {
  /** Whether the current page contains at least one matching snapshot. */
  found: boolean;
  total: number;
  shown: number;
  /** Number of matching snapshots after the visible page. */
  remaining: number;
  emptyReason: 'collection' | 'page' | null;
  offset: number;
  limit: number;
  pageSize: number;
  page: number;
  totalPages: number;
  previousPage: number | null;
  nextPage: number | null;
  /** Maximum supported offset for a list page. */
  maxOffset: number;
  hasPrevious: boolean;
  previousOffset: number | null;
  hasMore: boolean;
  nextOffset: number | null;
  suggestedOffset: number | null;
  oldestFirst: boolean;
  filters: ListJsonFilters;
  entries: ListSnapshotJson[];
}

export type ListJsonSummary = Omit<ListJson, 'entries'>;

/** Keep JSON tag values stable when older indexes contain whitespace or duplicates. */
export function normalizeListJsonTags(tags?: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags ?? []) {
    const trimmed = tag.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      normalized.push(trimmed);
    }
  }
  return normalized;
}

/** Keep JSON labels stable when older indexes contain surrounding whitespace. */
export function normalizeListJsonLabel(label?: string | null): string | null {
  const normalized = label?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

/** Keep JSON filter metadata aligned with the values used by the filter parser. */
export function normalizeListJsonFilters(filters: Partial<ListJsonFilters>): ListJsonFilters {
  return {
    since: filters.since?.trim() ?? null,
    until: filters.until?.trim() ?? null,
    platform: filters.platform?.trim().toLowerCase() ?? null,
    adapter: filters.adapter?.trim().toLowerCase() ?? null,
    exclude: [...new Set(
      (filters.exclude ?? [])
        .map((adapter) => adapter.trim().toLowerCase())
        .filter(Boolean),
    )],
    snapshot: filters.snapshot?.trim() ?? null,
    // Tag and label matching is case-insensitive, so expose the canonical
    // form that downstream consumers can compare with filtered results.
    tag: filters.tag?.trim().toLowerCase() ?? null,
    label: filters.label?.trim().toLowerCase() ?? null,
  };
}

/** Keep list pagination stable when snapshots share the same timestamp. */
export function sortListEntries(
  snapshots: SnapshotIndexEntry[],
  oldestFirst = false,
): SnapshotIndexEntry[] {
  return [...snapshots].sort((a, b) => {
    const timestampOrder = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (timestampOrder !== 0) return oldestFirst ? -timestampOrder : timestampOrder;
    // Keep ties deterministic in both directions so pagination does not reshuffle
    // snapshots that share a timestamp when users toggle --oldest-first.
    return a.id.localeCompare(b.id);
  });
}

export function formatListJson(
  snapshots: SnapshotIndexEntry[],
  limit = 50,
  offset?: number,
  oldestFirst = false,
  filters: Partial<ListJsonFilters> = {},
): string {
  const offsetValue = offset ?? 0;
  const visible = selectListOffsetEntries(
    sortListEntries(snapshots, oldestFirst),
    offset,
  )
    .slice(0, limit);
  const records: ListSnapshotJson[] = visible.map((snapshot) => ({
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      platform: snapshot.platform,
      adapter: snapshot.adapter,
      label: normalizeListJsonLabel(snapshot.label),
      tags: normalizeListJsonTags(snapshot.tags),
      filename: snapshot.filename,
      size: snapshot.size,
    }));
  // An empty collection has no navigable pages, even if a caller supplied a
  // stale offset. Keep the requested offset visible, but do not advertise a
  // previous page that cannot exist.
  const hasPrevious = offsetValue > 0 && snapshots.length > 0;
  const candidateNextOffset = offsetValue + records.length;
  // Keep machine-readable navigation actionable: the CLI rejects offsets
  // above MAX_LIST_OFFSET, so never advertise a next page it cannot open.
  const hasMore = candidateNextOffset < snapshots.length && candidateNextOffset <= MAX_LIST_OFFSET;
  const remaining = Math.max(0, snapshots.length - offsetValue - records.length);
  const emptyReason = records.length > 0
    ? null
    : snapshots.length === 0
      ? 'collection'
      : 'page';
  const suggestedOffset = records.length === 0 && snapshots.length > 0
    ? Math.min(MAX_LIST_OFFSET, Math.floor((snapshots.length - 1) / limit) * limit)
    : null;
  const totalPages = Math.ceil(snapshots.length / limit);
  const previousOffset = hasPrevious
    ? records.length === 0 && suggestedOffset !== null
      ? suggestedOffset
      : Math.max(0, offsetValue - limit)
    : null;
  const nextOffset = hasMore ? candidateNextOffset : null;
  const result: ListJson = {
    found: records.length > 0,
    total: snapshots.length,
    shown: records.length,
    remaining,
    emptyReason,
    offset: offsetValue,
    limit,
    pageSize: limit,
    page: Math.floor(offsetValue / limit) + 1,
    totalPages,
    previousPage: previousOffset === null ? null : Math.floor(previousOffset / limit) + 1,
    nextPage: nextOffset === null ? null : Math.floor(nextOffset / limit) + 1,
    maxOffset: MAX_LIST_OFFSET,
    hasPrevious,
    previousOffset,
    hasMore,
    nextOffset,
    suggestedOffset,
    oldestFirst,
    filters: normalizeListJsonFilters(filters),
    entries: records,
  };
  return JSON.stringify(result, null, 2);
}

/** Keep list pagination metadata available without loading snapshot records. */
export function formatListJsonSummary(
  snapshots: SnapshotIndexEntry[],
  limit = 50,
  offset?: number,
  oldestFirst = false,
  filters: Partial<ListJsonFilters> = {},
): string {
  const offsetValue = offset ?? 0;
  const visible = selectListOffsetEntries(
    sortListEntries(snapshots, oldestFirst),
    offset,
  ).slice(0, limit);
  const shown = visible.length;
  const suggestedOffset = shown === 0 && snapshots.length > 0
    ? Math.min(MAX_LIST_OFFSET, Math.floor((snapshots.length - 1) / limit) * limit)
    : null;
  // An empty collection has no navigable pages, even if a caller supplied a
  // stale offset. Keep the requested offset visible, but do not advertise a
  // previous page that cannot exist.
  const hasPrevious = offsetValue > 0 && snapshots.length > 0;
  const previousOffset = hasPrevious
    ? shown === 0 && suggestedOffset !== null
      ? suggestedOffset
      : Math.max(0, offsetValue - limit)
    : null;
  const candidateNextOffset = offsetValue + shown;
  // Keep machine-readable navigation actionable: the CLI rejects offsets
  // above MAX_LIST_OFFSET, so never advertise a next page it cannot open.
  const hasMore = candidateNextOffset < snapshots.length && candidateNextOffset <= MAX_LIST_OFFSET;
  const nextOffset = hasMore ? candidateNextOffset : null;
  const summary: ListJsonSummary = {
    found: shown > 0,
    total: snapshots.length,
    shown,
    remaining: Math.max(0, snapshots.length - offsetValue - shown),
    emptyReason: shown > 0 ? null : snapshots.length === 0 ? 'collection' : 'page',
    offset: offsetValue,
    limit,
    pageSize: limit,
    page: Math.floor(offsetValue / limit) + 1,
    totalPages: Math.ceil(snapshots.length / limit),
    previousPage: previousOffset === null ? null : Math.floor(previousOffset / limit) + 1,
    nextPage: nextOffset === null ? null : Math.floor(nextOffset / limit) + 1,
    maxOffset: MAX_LIST_OFFSET,
    hasPrevious,
    previousOffset,
    hasMore,
    nextOffset,
    suggestedOffset,
    oldestFirst,
    filters: normalizeListJsonFilters(filters),
  };
  return JSON.stringify(summary, null, 2);
}

export interface ListMissingJson {
  found: false;
  total: 0;
  shown: 0;
  remaining: 0;
  emptyReason: 'collection';
  offset: 0;
  limit: 50;
  pageSize: 50;
  page: 1;
  totalPages: 0;
  previousPage: null;
  nextPage: null;
  maxOffset: 1000;
  hasPrevious: false;
  previousOffset: null;
  hasMore: false;
  nextOffset: null;
  suggestedOffset: null;
  oldestFirst: false;
  filters: ListJsonFilters;
  entries: [];
  storage: null;
}

export function formatListMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      total: 0,
      shown: 0,
      remaining: 0,
      emptyReason: 'collection',
      offset: 0,
      limit: 50,
      pageSize: 50,
      page: 1,
      totalPages: 0,
      previousPage: null,
      nextPage: null,
      maxOffset: 1000,
      hasPrevious: false,
      previousOffset: null,
      hasMore: false,
      nextOffset: null,
      suggestedOffset: null,
      oldestFirst: false,
      filters: normalizeListJsonFilters({}),
      entries: [],
      storage: null,
    },
    null,
    2,
  );
}

export function formatListMissingJsonSummary(): string {
  return JSON.stringify({
    found: false,
    total: 0,
    shown: 0,
    remaining: 0,
    emptyReason: 'collection',
    offset: 0,
    limit: 50,
    pageSize: 50,
    page: 1,
    totalPages: 0,
    previousPage: null,
    nextPage: null,
    maxOffset: 1000,
    hasPrevious: false,
    previousOffset: null,
    hasMore: false,
    nextOffset: null,
    suggestedOffset: null,
    oldestFirst: false,
    filters: normalizeListJsonFilters({}),
  } satisfies ListJsonSummary, null, 2);
}

/** Parse a snapshot-list limit without turning user input errors into empty output. */
export function parseListLimit(value: string | undefined): number {
  if (value === undefined) return 50;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_LIST_LIMIT}.`,
    );
  }

  const limit = Number(normalized);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_LIST_LIMIT}.`,
    );
  }
  return limit;
}

/** Parse list --offset without turning user input errors into an unbounded skip. */
export function parseListOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_LIST_OFFSET}.`,
    );
  }

  const offset = Number(normalized);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_LIST_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_LIST_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N snapshots when list --offset is set. */
export function selectListOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}

/** Explain how to recover when a stale list offset skips past every match. */
export function formatListEmptyState(
  matchingCount: number,
  offset: number,
  limit = 50,
): string {
  if (matchingCount === 0) {
    return 'No snapshots found matching the criteria. Try adjusting the filters.';
  }

  const suggestedOffset = Math.floor((matchingCount - 1) / limit) * limit;
  return `No snapshots shown: offset ${offset} skips past ${matchingCount} matching ${
    matchingCount === 1 ? 'snapshot' : 'snapshots'
  }. Try --offset ${suggestedOffset} to open the nearest available page.`;
}

/** Describe the visible list page without treating an offset as part of the limit. */
export function formatListPageSummary(total: number, shown: number, offset = 0, limit = 50): string {
  const pageEnd = Math.min(offset + limit, total);
  if (shown === 0 && total > 0 && offset >= total) {
    const suggestedOffset = Math.floor((total - 1) / limit) * limit;
    return `(no snapshots shown: offset ${offset} skips past ${total} after filters; ` +
      `try --offset ${suggestedOffset} to open the nearest available page)`;
  }
  if (offset === 0 && pageEnd === total) return `(showing ${shown} of ${total} after filters)`;

  const hints = [`offset ${offset}`, `limit ${limit}`];
  if (pageEnd < total) hints.push(`next offset ${offset + shown}`);
  if (offset > 0) hints.push(`previous offset ${Math.max(0, offset - limit)}`);
  return `(showing ${shown} of ${total} after filters; ${hints.join('; ')})`;
}

/** Pad the visible label text before applying terminal styling to placeholders. */
export function formatListLabelCell(label: string | null, width: number): string {
  if (label !== null) return label.trim().padEnd(width);
  return chalk.dim('—'.padEnd(width));
}

/** Keep legacy label whitespace out of machine-readable list output too. */
export function normalizeListLabel(label: string | null | undefined): string | null {
  if (label === undefined || label === null || label.trim().length === 0) return null;
  return label.trim();
}

/** Size the label column from the text users actually see. */
export function getListLabelWidth(snapshots: SnapshotIndexEntry[]): number {
  return Math.max(5, ...snapshots.map((snapshot) => normalizeListLabel(snapshot.label)?.length ?? 0));
}

/** Parse list --since without treating invalid dates as an empty snapshot list. */
export function parseListSince(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  // Date-only input is a human-facing calendar boundary. Validate the
  // calendar date before parsing so JavaScript cannot silently normalize an
  // impossible date such as 2026-02-30 into a later day. Apply the same
  // protection to timestamps, whose calendar prefix is normalized too.
  const normalized = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  let ms: number;
  if (dateOnly) {
    ms = isValidListCalendarDate(normalized)
      ? new Date(`${normalized}T00:00:00.000Z`).getTime()
      : Number.NaN;
  } else {
    ms = hasInvalidListCalendarDate(normalized) ? Number.NaN : new Date(normalized).getTime();
  }
  if (Number.isNaN(ms)) throw new Error(`Invalid --since value "${value}". Expected an ISO 8601 date.`);
  return ms;
}

/** Parse list --until without treating invalid dates as an empty snapshot list. */
export function parseListUntil(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  // Date-only input is a human-facing calendar boundary. Treat it as the
  // end of that UTC day so `--until 2026-10-12` includes that day's snapshots.
  const normalized = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  let ms: number;
  if (dateOnly) {
    ms = isValidListCalendarDate(normalized)
      ? new Date(`${normalized}T23:59:59.999Z`).getTime()
      : Number.NaN;
  } else {
    ms = hasInvalidListCalendarDate(normalized) ? Number.NaN : new Date(normalized).getTime();
  }
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid --until value "${value}". Expected an ISO 8601 date.`,
    );
  }
  return ms;
}

/** Reject timestamps whose ISO calendar prefix would otherwise be normalized. */
function hasInvalidListCalendarDate(value: string): boolean {
  const datePrefix = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
  return datePrefix !== null && !isValidListCalendarDate(datePrefix[0].slice(0, 10));
}

function isValidListCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;

  const daysInMonth = [31, isLeapListYear(year) ? 29 : 28, 31, 30, 31, 30,
    31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

function isLeapListYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Reject an inverted date window before it silently produces an empty result. */
export function validateListDateRange(since?: string, until?: string): void {
  const sinceMs = parseListSince(since);
  const untilMs = parseListUntil(until);

  if (sinceMs !== undefined && untilMs !== undefined && sinceMs > untilMs) {
    throw new Error(
      `Invalid list date range: --since (${since}) must be on or before --until (${until}).`,
    );
  }
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

/** Parse list --platform without treating blank or comma-separated values as an empty result. */
export function parseListPlatform(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const platform = value.trim().toLowerCase();
  if (platform.length === 0 || platform.includes(',') || /\s/.test(platform)) {
    throw new Error(
      `Invalid --platform value "${value}". Expected a single non-empty platform id.`,
    );
  }

  return platform;
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

/** Parse list --label without treating blank or comma-separated values as an empty snapshot list. */
export function parseListLabel(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const label = value.trim();
  if (label.length === 0 || label.includes(',')) {
    throw new Error(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  }

  return label;
}

export async function listCommand(options: ListOptions): Promise<void> {
  validateListDateRange(options.since, options.until);
  parseListAdapter(options.adapter);
  parseListPlatform(options.platform);
  parseListExclude(options.exclude);
  parseListSnapshot(options.snapshot);
  parseListTag(options.tag);
  parseListLabel(options.label);

  const jsonOutput = options.json === true || options.jsonSummary === true;
  if (!jsonOutput) {
    console.log();
  }

  if (!isInitialized()) {
    if (jsonOutput) {
      console.log(options.jsonSummary ? formatListMissingJsonSummary() : formatListMissingJson());
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const limit = parseListLimit(options.limit);
  const offset = parseListOffset(options.offset);
  const index = await loadIndex();

  const filtered = applyListFilters(index.snapshots, options);
  const oldestFirst = Boolean(options.oldestFirst || options.reverse);

  if (jsonOutput) {
    console.log(
      options.jsonSummary
        ? formatListJsonSummary(filtered, limit, offset, oldestFirst, {
          since: options.since,
          until: options.until,
          platform: options.platform,
          adapter: options.adapter,
          exclude: options.exclude ? parseListExclude(options.exclude) : undefined,
          snapshot: options.snapshot,
          tag: options.tag,
          label: options.label,
        })
        : formatListJson(filtered, limit, offset, oldestFirst, {
        since: options.since,
        until: options.until,
        platform: options.platform,
        adapter: options.adapter,
        exclude: options.exclude ? parseListExclude(options.exclude) : undefined,
        snapshot: options.snapshot,
        tag: options.tag,
        label: options.label,
        }),
    );
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

  if (offset !== undefined && offset >= filtered.length) {
    console.log(chalk.dim(`  ${formatListEmptyState(filtered.length, offset, limit)}`));
    console.log();
    return;
  }

  // Sort by timestamp, then skip/limit.
  const sorted = selectListOffsetEntries(
    sortListEntries(filtered, oldestFirst),
    offset,
  ).slice(0, limit);

  // Calculate column widths
  const idWidth = Math.max(10, ...sorted.map((s) => s.id.length));
  const dateWidth = 20;
  const adapterWidth = Math.max(7, ...sorted.map((s) => s.adapter.length));
  const labelWidth = getListLabelWidth(sorted);
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
    const date = formatListDate(s.timestamp);
    const label = formatListLabelCell(normalizeListLabel(s.label), labelWidth);
    const size = formatBytes(s.size);

    const row = [
      chalk.cyan(s.id.padEnd(idWidth)),
      date.padEnd(dateWidth),
      s.adapter.padEnd(adapterWidth),
      label,
      size.padStart(sizeWidth),
    ].join('  ');

    console.log(`  ${row}`);
  }

  console.log();
  console.log(chalk.dim(`  ${sorted.length} snapshot${sorted.length !== 1 ? 's' : ''}`));
  if (offset !== undefined || filtered.length > limit) {
    console.log(chalk.dim(`  ${formatListPageSummary(filtered.length, sorted.length, offset, limit)}`));
  } else if (filtered.length !== index.snapshots.length) {
    console.log(chalk.dim(`  (filtered from ${index.snapshots.length} total)`));
  }
  console.log();
}

export function applyListFilters(
  snapshots: SnapshotIndexEntry[],
  options: { since?: string; until?: string; platform?: string; adapter?: string; exclude?: string; snapshot?: string; tag?: string; label?: string },
): SnapshotIndexEntry[] {
  validateListDateRange(options.since, options.until);
  const since = parseListSince(options.since);
  const until = parseListUntil(options.until);
  const adapter = parseListAdapter(options.adapter);
  const platform = parseListPlatform(options.platform);
  const exclude = parseListExclude(options.exclude);
  const snapshotId = parseListSnapshot(options.snapshot);
  const tag = parseListTag(options.tag);
  const label = parseListLabel(options.label);

  return snapshots.filter((s) => {
    const ts = new Date(s.timestamp).getTime();
    if (since !== undefined && ts < since) return false;
    if (until !== undefined && ts > until) return false;
    // Indexes created by older adapters may preserve casing or whitespace.
    // Match adapter filters the same way as platform filters so normalized
    // CLI input remains useful across those legacy entries.
    if (adapter && s.adapter.trim().toLowerCase() !== adapter) return false;
    if (platform && s.platform.trim().toLowerCase() !== platform) return false;
    if (exclude !== undefined && exclude.includes(s.adapter.trim().toLowerCase())) return false;
    if (snapshotId !== undefined && s.id !== snapshotId) return false;
    if (
      tag &&
      !(s.tags ?? []).some((value) => value.trim().toLowerCase() === tag.toLowerCase())
    ) return false;
    if (label !== undefined && s.label?.trim().toLowerCase() !== label.toLowerCase()) return false;
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

export function formatListDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    year: 'numeric',
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
