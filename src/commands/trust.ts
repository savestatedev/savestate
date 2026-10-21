/**
 * savestate trust — inspect Trust Kernel state.
 *
 * Subcommands:
 *   status   — entries by state/scope, denylist size, recent activity counts
 *   audit    — recent transition events (most recent first)
 *
 * Read-only. Surfaces the Trust Kernel's audit trail to operators so they
 * can see what's been promoted, rejected, or revoked without spelunking
 * through the SQLite store.
 */

import chalk from 'chalk';
import { TrustStore } from '../trust-kernel/store.js';
import type { PromotionScope, TransitionEvent, TrustMetrics, TrustState } from '../trust-kernel/types.js';

interface TrustOptions {
  json?: boolean;
  limit?: string;
  offset?: string;
}

const MAX_TRUST_AUDIT_LIMIT = 1000;

/** Parse a trust audit event cap without turning user input errors into empty output. */
export function parseTrustAuditLimit(value: string | undefined): number {
  if (value === undefined) return 50;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_TRUST_AUDIT_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_TRUST_AUDIT_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N audit events when --limit is set. */
export function selectTrustAuditEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

const MAX_TRUST_AUDIT_OFFSET = 1000;

/** Parse trust audit --offset without turning user input errors into an empty audit trail. */
export function parseTrustAuditOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_TRUST_AUDIT_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_TRUST_AUDIT_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N audit events when --offset is set. */
export function selectTrustAuditOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}

/** Apply trust audit --offset then --limit. */
export function applyTrustAuditFilters<T>(
  entries: T[],
  options: { offset?: string; limit?: string },
): T[] {
  return selectTrustAuditEntries(
    selectTrustAuditOffsetEntries(entries, parseTrustAuditOffset(options.offset)),
    parseTrustAuditLimit(options.limit),
  );
}

/** Parse trust deny --reason without writing a blank denylist reason. */
export function parseTrustReason(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const reason = value.trim();
  if (reason.length === 0) {
    throw new Error(
      `Invalid --reason value "${value}". Expected a non-empty reason.`,
    );
  }

  return reason;
}

/** Parse trust deny --by without writing a blank denylist actor. */
export function parseTrustBy(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const actor = value.trim();
  if (actor.length === 0 || actor.includes(',') || /\s/.test(actor)) {
    throw new Error(
      `Invalid --by value "${value}". Expected a single non-empty actor id.`,
    );
  }

  return actor;
}

/** Parse trust deny pattern without writing a blank or comma-separated denylist entry. */
export function parseTrustPattern(value: string | undefined): string {
  if (value === undefined) {
    throw new Error(
      'Invalid pattern. Expected a single non-empty denylist pattern.',
    );
  }

  const pattern = value.trim();
  if (pattern.length === 0 || pattern.includes(',') || /\s/.test(pattern)) {
    throw new Error(
      `Invalid pattern "${value}". Expected a single non-empty denylist pattern.`,
    );
  }

  return pattern;
}

interface DenyAddOptions {
  reason?: string;
  by?: string;
  json?: boolean;
  limit?: string;
  offset?: string;
}

const MAX_TRUST_DENY_ADD_LIMIT = 1000;
const MAX_TRUST_DENY_ADD_OFFSET = 1000;

/** Parse trust deny add --limit without turning user input errors into an empty add. */
export function parseTrustDenyAddLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_TRUST_DENY_ADD_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_TRUST_DENY_ADD_LIMIT}.`,
    );
  }
  return limit;
}

/** Parse trust deny add --offset without turning user input errors into an unbounded skip. */
export function parseTrustDenyAddOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_TRUST_DENY_ADD_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_TRUST_DENY_ADD_OFFSET}.`,
    );
  }
  return offset;
}

/** Apply deny-add --offset before --limit to status field rows. */
export function selectTrustDenyAddEntries<T>(
  entries: T[],
  limit?: number,
  offset?: number,
): T[] {
  return entries.slice(offset ?? 0, (offset ?? 0) + (limit ?? entries.length));
}

/** Explain when deny-add status pagination skips past every status field. */
export function formatTrustDenyStatusEmptyMessage(total: number, offset = 0): string {
  return `No status fields on this page (total: ${total}; offset: ${offset}). Try a smaller --offset.`;
}

interface DenyListOptions {
  json?: boolean;
  limit?: string;
  offset?: string;
}

const MAX_TRUST_DENY_REMOVE_LIMIT = 1000;
const MAX_TRUST_DENY_REMOVE_OFFSET = 1000;

/** Parse trust deny remove --limit without turning user input errors into an empty remove. */
export function parseTrustDenyRemoveLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_TRUST_DENY_REMOVE_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_TRUST_DENY_REMOVE_LIMIT}.`,
    );
  }
  return limit;
}

/** Parse trust deny remove --offset without turning user input errors into an unbounded skip. */
export function parseTrustDenyRemoveOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_TRUST_DENY_REMOVE_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_TRUST_DENY_REMOVE_OFFSET}.`,
    );
  }
  return offset;
}

/** Apply deny-remove --offset before --limit to status field rows. */
export function selectTrustDenyRemoveEntries<T>(
  entries: T[],
  limit?: number,
  offset?: number,
): T[] {
  return entries.slice(offset ?? 0, (offset ?? 0) + (limit ?? entries.length));
}

const MAX_TRUST_DENY_LIST_LIMIT = 1000;

/** Parse trust deny list --limit without turning user input errors into an empty denylist. */
export function parseTrustDenyListLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_TRUST_DENY_LIST_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_TRUST_DENY_LIST_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N denylist entries when --limit is set. */
export function selectTrustDenyListEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

const MAX_TRUST_DENY_LIST_OFFSET = 1000;

/** Parse trust deny list --offset without turning user input errors into an empty denylist. */
export function parseTrustDenyListOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_TRUST_DENY_LIST_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_TRUST_DENY_LIST_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N denylist entries when --offset is set. */
export function selectTrustDenyListOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}

/** Apply trust deny list --offset then --limit. */
export function applyTrustDenyListFilters<T>(
  entries: T[],
  options: { offset?: string; limit?: string },
): T[] {
  return selectTrustDenyListEntries(
    selectTrustDenyListOffsetEntries(entries, parseTrustDenyListOffset(options.offset)),
    parseTrustDenyListLimit(options.limit),
  );
}

/** Explain whether an empty page means an empty denylist or an exhausted offset. */
export function formatTrustDenyListEmptyMessage(total: number, offset = 0): string {
  if (total === 0) return 'No patterns on the denylist.';
  return `No denylist entries on this page (total: ${total}; offset: ${offset}). Try a smaller --offset.`;
}

/** Explain whether an empty audit page means no history or an exhausted offset. */
export function formatTrustAuditEmptyMessage(total: number, offset = 0): string {
  if (total === 0) return 'No transitions recorded yet.';
  return `No audit events on this page (total: ${total}; offset: ${offset}). Try a smaller --offset.`;
}

const MAX_TRUST_STATUS_LIMIT = 1000;

/** Parse trust status --limit without turning user input errors into an empty metrics view. */
export function parseTrustStatusLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_TRUST_STATUS_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_TRUST_STATUS_LIMIT}.`,
    );
  }
  return limit;
}

/** Keep the first N state or scope metric rows when --limit is set. */
export function selectTrustStatusEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

const MAX_TRUST_STATUS_OFFSET = 1000;

/** Parse trust status --offset without turning user input errors into an empty metrics view. */
export function parseTrustStatusOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_TRUST_STATUS_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_TRUST_STATUS_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N state or scope metric rows when --offset is set. */
export function selectTrustStatusOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}

/** Apply trust status --offset then --limit. */
export function applyTrustStatusFilters<T>(
  entries: T[],
  options: { offset?: string; limit?: string },
): T[] {
  return selectTrustStatusEntries(
    selectTrustStatusOffsetEntries(entries, parseTrustStatusOffset(options.offset)),
    parseTrustStatusLimit(options.limit),
  );
}

const EMPTY_ENTRIES_BY_STATE: Record<TrustState, number> = {
  candidate: 0,
  stable: 0,
  rejected: 0,
  quarantined: 0,
  revoked: 0,
};

const EMPTY_ENTRIES_BY_SCOPE: Record<PromotionScope, number> = {
  semantic: 0,
  procedural: 0,
  episodic: 0,
};

export interface TrustJson {
  entriesByState: Partial<Record<TrustState, number>>;
  entriesByScope: Partial<Record<PromotionScope, number>>;
  promotionsLastHour: number;
  rejectionsLastHour: number;
  denylistSize: number;
  avgPromotionLatencyMs: number;
  writeGateP95Ms: number;
  actionGateP95Ms: number;
  criticalBreaches: number;
  pagination: {
    offset: number;
    limit: number | null;
    state: { total: number; shown: number; hasMore: boolean; nextOffset: number | null };
    scope: { total: number; shown: number; hasMore: boolean; nextOffset: number | null };
  };
}

function formatTrustMetricPage<T extends string>(
  entries: Record<T, number>,
  options: Pick<TrustOptions, 'limit' | 'offset'>,
): { values: Partial<Record<T, number>>; total: number; shown: number; hasMore: boolean; nextOffset: number | null } {
  const offset = parseTrustStatusOffset(options.offset) ?? 0;
  const limit = parseTrustStatusLimit(options.limit);
  const page = applyTrustStatusFilters(Object.entries(entries), options);
  const values = Object.fromEntries(page) as Partial<Record<T, number>>;
  const hasMore = offset + page.length < Object.keys(entries).length;

  return {
    values,
    total: Object.keys(entries).length,
    shown: page.length,
    hasMore,
    nextOffset: hasMore ? offset + (limit ?? page.length) : null,
  };
}

export function formatTrustJson(
  metrics: TrustMetrics,
  options: Pick<TrustOptions, 'limit' | 'offset'> = {},
): string {
  const state = formatTrustMetricPage(metrics.entriesByState, options);
  const scope = formatTrustMetricPage(metrics.entriesByScope, options);
  const offset = parseTrustStatusOffset(options.offset) ?? 0;
  const limit = parseTrustStatusLimit(options.limit);
  const filtered = options.offset !== undefined || options.limit !== undefined;
  const record: TrustJson = {
    entriesByState: filtered ? state.values : { ...EMPTY_ENTRIES_BY_STATE, ...state.values },
    entriesByScope: filtered ? scope.values : { ...EMPTY_ENTRIES_BY_SCOPE, ...scope.values },
    promotionsLastHour: metrics.promotionsLastHour,
    rejectionsLastHour: metrics.rejectionsLastHour,
    denylistSize: metrics.denylistSize,
    avgPromotionLatencyMs: metrics.avgPromotionLatencyMs,
    writeGateP95Ms: metrics.writeGateP95Ms,
    actionGateP95Ms: metrics.actionGateP95Ms,
    criticalBreaches: metrics.criticalBreaches,
    pagination: {
      offset,
      limit: limit ?? null,
      state: {
        total: state.total,
        shown: state.shown,
        hasMore: state.hasMore,
        nextOffset: state.nextOffset,
      },
      scope: {
        total: scope.total,
        shown: scope.shown,
        hasMore: scope.hasMore,
        nextOffset: scope.nextOffset,
      },
    },
  };
  return JSON.stringify(record, null, 2);
}

export interface TrustDenyListEntryJson {
  id: string;
  pattern: string;
  reason: string;
  addedAt: string;
  addedBy: string;
  epoch: number;
}

export interface TrustDenyListJson {
  entries: TrustDenyListEntryJson[];
  pagination: {
    offset: number;
    limit: number | null;
    total: number;
    shown: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
}

export function formatTrustDenyListJson(
  entries: Array<{
    id: string;
    pattern: string;
    reason: string;
    addedAt: string;
    addedBy: string;
    epoch: number;
  }>,
  options: Pick<DenyListOptions, 'limit' | 'offset'> = {},
): string {
  const offset = parseTrustDenyListOffset(options.offset) ?? 0;
  const limit = parseTrustDenyListLimit(options.limit);
  const page = applyTrustDenyListFilters(entries, options);
  const hasMore = offset + page.length < entries.length;

  return JSON.stringify(
    {
      entries: page.map((entry) => ({
        id: entry.id,
        pattern: entry.pattern,
        reason: entry.reason,
        addedAt: entry.addedAt,
        addedBy: entry.addedBy,
        epoch: entry.epoch,
      })),
      pagination: {
        offset,
        limit: limit ?? null,
        total: entries.length,
        shown: page.length,
        hasMore,
        nextOffset: hasMore ? offset + (limit ?? page.length) : null,
      },
    },
    null,
    2,
  );
}

export interface TrustDenyRemoveJson {
  pattern: string;
  removed: number;
}

export function formatTrustDenyRemoveJson(result: TrustDenyRemoveJson): string {
  return JSON.stringify(
    {
      pattern: result.pattern,
      removed: result.removed,
    },
    null,
    2,
  );
}

export interface TrustDenyRemoveMissingJson {
  found: false;
  pattern: string;
  removed: 0;
}

export function formatTrustDenyRemoveMissingJson(pattern: string): string {
  return JSON.stringify(
    {
      found: false,
      pattern,
      removed: 0,
    },
    null,
    2,
  );
}

export interface TrustAuditEventJson {
  id: string;
  entryId: string;
  fromState: TrustState;
  toState: TrustState;
  reason: string;
  actor: string;
  timestamp: string;
}

export interface TrustAuditJson {
  events: TrustAuditEventJson[];
  pagination: {
    offset: number;
    limit: number | null;
    total: number;
    shown: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
}

export function formatTrustAuditJson(
  events: TransitionEvent[],
  options: Pick<TrustOptions, 'limit' | 'offset'> = {},
): string {
  const page = applyTrustAuditFilters(events, options);
  const offset = parseTrustAuditOffset(options.offset) ?? 0;
  const limit = parseTrustAuditLimit(options.limit);
  const pagination = {
    offset,
    limit,
    total: events.length,
    shown: page.length,
    hasMore: offset + page.length < events.length,
    nextOffset: offset + page.length < events.length
      ? offset + limit
      : null,
  };

  return JSON.stringify(
    {
      events: page.map((event) => ({
        id: event.id,
        entryId: event.entryId,
        fromState: event.fromState,
        toState: event.toState,
        reason: event.reason,
        actor: event.actor,
        timestamp: event.timestamp,
      })),
      pagination,
    },
    null,
    2,
  );
}

export interface TrustDenyAddJson {
  added: string;
  reason: string;
  addedBy: string;
}

export function formatTrustDenyAddJson(result: TrustDenyAddJson): string {
  return JSON.stringify(
    {
      added: result.added,
      reason: result.reason,
      addedBy: result.addedBy,
    },
    null,
    2,
  );
}

export async function trustStatusCommand(options: TrustOptions): Promise<void> {
  parseTrustStatusLimit(options.limit);
  parseTrustStatusOffset(options.offset);
  const store = new TrustStore();
  const metrics = store.getMetrics();

  if (options.json) {
    console.log(formatTrustJson(metrics, options));
    store.close();
    return;
  }

  console.log();
  console.log(chalk.bold('🛡  Trust Kernel'));
  console.log();
  console.log(chalk.dim('  Entries by state:'));
  for (const [state, count] of applyTrustStatusFilters(Object.entries(metrics.entriesByState), options)) {
    console.log(`    ${chalk.cyan(state.padEnd(12))} ${count}`);
  }
  console.log();
  console.log(chalk.dim('  Entries by scope:'));
  for (const [scope, count] of applyTrustStatusFilters(Object.entries(metrics.entriesByScope), options)) {
    console.log(`    ${chalk.cyan(scope.padEnd(12))} ${count}`);
  }
  console.log();
  console.log(chalk.dim('  Last hour:'));
  printRow('  Promotions', String(metrics.promotionsLastHour));
  printRow('  Rejections', String(metrics.rejectionsLastHour));
  console.log();
  printRow('Denylist size', String(metrics.denylistSize));
  console.log();

  store.close();
}

export async function trustAuditCommand(options: TrustOptions): Promise<void> {
  const store = new TrustStore();
  const offset = parseTrustAuditOffset(options.offset);
  const limit = parseTrustAuditLimit(options.limit);
  const allEvents = store.getRecentTransitions(MAX_TRUST_AUDIT_LIMIT);
  const events = applyTrustAuditFilters(allEvents, options);

  if (options.json) {
    console.log(formatTrustAuditJson(allEvents, options));
    store.close();
    return;
  }

  console.log();
  console.log(chalk.bold(`🧾 Trust Audit  ${chalk.dim(`(last ${events.length})`)}`));
  console.log();

  if (events.length === 0) {
    console.log(chalk.dim(`  ${formatTrustAuditEmptyMessage(allEvents.length, offset ?? 0)}`));
    console.log();
    store.close();
    return;
  }

  for (const e of events) {
    const ts = new Date(e.timestamp).toISOString().slice(0, 19).replace('T', ' ');
    const arrow = `${stateColor(e.fromState)}${chalk.dim(' → ')}${stateColor(e.toState)}`;
    console.log(`  ${chalk.dim(ts)}  ${arrow}  ${chalk.dim(`(${e.actor})`)}`);
    console.log(`    ${chalk.dim('id:')} ${chalk.cyan(e.entryId)}`);
    console.log(`    ${chalk.dim('reason:')} ${e.reason}`);
    console.log();
  }

  store.close();
}

function stateColor(state: string): string {
  switch (state) {
    case 'stable':
      return chalk.green(state);
    case 'rejected':
    case 'revoked':
      return chalk.red(state);
    case 'quarantined':
      return chalk.yellow(state);
    case 'candidate':
    default:
      return chalk.cyan(state);
  }
}

function printRow(label: string, value: string): void {
  console.log(`  ${chalk.dim(label.padEnd(18))} ${value}`);
}

export async function trustDenyAddCommand(
  rawPattern: string,
  options: DenyAddOptions,
): Promise<void> {
  const pattern = parseTrustPattern(rawPattern);
  const limit = parseTrustDenyAddLimit(options.limit);
  const offset = parseTrustDenyAddOffset(options.offset);
  const store = new TrustStore();
  const reason = parseTrustReason(options.reason) ?? 'no reason given';
  const addedBy = parseTrustBy(options.by) ?? 'cli';
  store.addToDenylist(pattern, reason, addedBy);
  store.close();

  if (options.json) {
    console.log(formatTrustDenyAddJson({ added: pattern, reason, addedBy }));
    return;
  }
  console.log();
  const rows = [
    chalk.green(`✓ Added to denylist: ${chalk.cyan(pattern)}`),
    chalk.dim(`  reason: ${reason}`),
    chalk.dim(`  by:     ${addedBy}`),
  ];
  const page = selectTrustDenyAddEntries(rows, limit, offset);
  for (const row of page) {
    console.log(row);
  }
  if (page.length === 0) {
    console.log(chalk.dim(`  ${formatTrustDenyStatusEmptyMessage(rows.length, offset ?? 0)}`));
  }
  console.log();
}

export async function trustDenyRemoveCommand(
  rawPattern: string,
  options: DenyListOptions,
): Promise<void> {
  const pattern = parseTrustPattern(rawPattern);
  const limit = parseTrustDenyRemoveLimit(options.limit);
  const offset = parseTrustDenyRemoveOffset(options.offset);
  const store = new TrustStore();
  const removed = store.removeFromDenylist(pattern);
  store.close();

  if (options.json) {
    if (removed === 0) {
      console.log(formatTrustDenyRemoveMissingJson(pattern));
      return;
    }
    console.log(formatTrustDenyRemoveJson({ pattern, removed }));
    return;
  }
  console.log();
  const rows = removed === 0
    ? [
        chalk.yellow(`⚠ No denylist entry matched: ${pattern}`),
        chalk.dim(`  pattern: ${pattern}`),
        chalk.dim(`  removed: 0`),
      ]
    : [
        chalk.green(`✓ Removed ${removed} denylist entry(ies) matching: ${chalk.cyan(pattern)}`),
        chalk.dim(`  pattern: ${pattern}`),
        chalk.dim(`  removed: ${removed}`),
      ];
  const page = selectTrustDenyRemoveEntries(rows, limit, offset);
  for (const row of page) {
    console.log(row);
  }
  if (page.length === 0) {
    console.log(chalk.dim(`  ${formatTrustDenyStatusEmptyMessage(rows.length, offset ?? 0)}`));
  }
  console.log();
}

export async function trustDenyListCommand(options: DenyListOptions): Promise<void> {
  const store = new TrustStore();
  const allEntries = store.listDenylist();
  const entries = applyTrustDenyListFilters(allEntries, options);
  store.close();

  if (options.json) {
    console.log(formatTrustDenyListJson(allEntries, options));
    return;
  }

  console.log();
  console.log(chalk.bold(`🚫 Denylist  ${chalk.dim(`(${entries.length} entries)`)}`));
  console.log();
  if (entries.length === 0) {
    console.log(chalk.dim(`  ${formatTrustDenyListEmptyMessage(allEntries.length, parseTrustDenyListOffset(options.offset) ?? 0)}`));
    console.log();
    return;
  }

  for (const e of entries) {
    const ts = new Date(e.addedAt).toISOString().slice(0, 19).replace('T', ' ');
    console.log(`  ${chalk.cyan(e.pattern)}`);
    console.log(`    ${chalk.dim('reason:')} ${e.reason}`);
    console.log(`    ${chalk.dim('by:')} ${e.addedBy}  ${chalk.dim(ts)}  ${chalk.dim(`epoch ${e.epoch}`)}`);
    console.log();
  }
}

// Type re-export so the index module can pick it up.
export type { TrustMetrics, TransitionEvent };
