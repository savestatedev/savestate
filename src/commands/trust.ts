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
}

interface DenyAddOptions {
  reason?: string;
  by?: string;
  json?: boolean;
}

interface DenyListOptions {
  json?: boolean;
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
  entriesByState: Record<TrustState, number>;
  entriesByScope: Record<PromotionScope, number>;
  promotionsLastHour: number;
  rejectionsLastHour: number;
  denylistSize: number;
  avgPromotionLatencyMs: number;
  writeGateP95Ms: number;
  actionGateP95Ms: number;
  criticalBreaches: number;
}

export function formatTrustJson(metrics: TrustMetrics): string {
  const record: TrustJson = {
    entriesByState: { ...EMPTY_ENTRIES_BY_STATE, ...metrics.entriesByState },
    entriesByScope: { ...EMPTY_ENTRIES_BY_SCOPE, ...metrics.entriesByScope },
    promotionsLastHour: metrics.promotionsLastHour,
    rejectionsLastHour: metrics.rejectionsLastHour,
    denylistSize: metrics.denylistSize,
    avgPromotionLatencyMs: metrics.avgPromotionLatencyMs,
    writeGateP95Ms: metrics.writeGateP95Ms,
    actionGateP95Ms: metrics.actionGateP95Ms,
    criticalBreaches: metrics.criticalBreaches,
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
): string {
  return JSON.stringify(
    {
      entries: entries.map((entry) => ({
        id: entry.id,
        pattern: entry.pattern,
        reason: entry.reason,
        addedAt: entry.addedAt,
        addedBy: entry.addedBy,
        epoch: entry.epoch,
      })),
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
}

export function formatTrustAuditJson(events: TransitionEvent[]): string {
  return JSON.stringify(
    {
      events: events.map((event) => ({
        id: event.id,
        entryId: event.entryId,
        fromState: event.fromState,
        toState: event.toState,
        reason: event.reason,
        actor: event.actor,
        timestamp: event.timestamp,
      })),
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
  const store = new TrustStore();
  const metrics = store.getMetrics();

  if (options.json) {
    console.log(formatTrustJson(metrics));
    store.close();
    return;
  }

  console.log();
  console.log(chalk.bold('🛡  Trust Kernel'));
  console.log();
  console.log(chalk.dim('  Entries by state:'));
  for (const [state, count] of Object.entries(metrics.entriesByState)) {
    console.log(`    ${chalk.cyan(state.padEnd(12))} ${count}`);
  }
  console.log();
  console.log(chalk.dim('  Entries by scope:'));
  for (const [scope, count] of Object.entries(metrics.entriesByScope)) {
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
  const limit = options.limit ? parseInt(options.limit, 10) : 50;
  const events = store.getRecentTransitions(limit);

  if (options.json) {
    console.log(formatTrustAuditJson(events));
    store.close();
    return;
  }

  console.log();
  console.log(chalk.bold(`🧾 Trust Audit  ${chalk.dim(`(last ${events.length})`)}`));
  console.log();

  if (events.length === 0) {
    console.log(chalk.dim('  No transitions recorded yet.'));
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
  pattern: string,
  options: DenyAddOptions,
): Promise<void> {
  const store = new TrustStore();
  const reason = options.reason ?? 'no reason given';
  const addedBy = options.by ?? 'cli';
  store.addToDenylist(pattern, reason, addedBy);
  store.close();

  if (options.json) {
    console.log(formatTrustDenyAddJson({ added: pattern, reason, addedBy }));
    return;
  }
  console.log();
  console.log(chalk.green(`✓ Added to denylist: ${chalk.cyan(pattern)}`));
  console.log(chalk.dim(`  reason: ${reason}`));
  console.log(chalk.dim(`  by:     ${addedBy}`));
  console.log();
}

export async function trustDenyRemoveCommand(
  pattern: string,
  options: DenyListOptions,
): Promise<void> {
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
  if (removed === 0) {
    console.log(chalk.yellow(`⚠ No denylist entry matched: ${pattern}`));
  } else {
    console.log(chalk.green(`✓ Removed ${removed} denylist entry(ies) matching: ${chalk.cyan(pattern)}`));
  }
  console.log();
}

export async function trustDenyListCommand(options: DenyListOptions): Promise<void> {
  const store = new TrustStore();
  const entries = store.listDenylist();
  store.close();

  if (options.json) {
    console.log(formatTrustDenyListJson(entries));
    return;
  }

  console.log();
  console.log(chalk.bold(`🚫 Denylist  ${chalk.dim(`(${entries.length} entries)`)}`));
  console.log();
  if (entries.length === 0) {
    console.log(chalk.dim('  No patterns on the denylist.'));
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
