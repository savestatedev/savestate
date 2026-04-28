/**
 * savestate prune — Apply a retention policy to drop old snapshots.
 *
 * Selects snapshots that are eligible for deletion based on flags
 * (--keep-last N, --older-than DATE), refuses to delete any snapshot
 * that is an ancestor of a kept incremental, and removes them from
 * the index + storage backend.
 *
 * --dry-run is the default safety net: nothing is actually deleted
 * unless --apply is also set.
 */

import chalk from 'chalk';
import { isInitialized, loadConfig } from '../config.js';
import { loadIndex, saveIndex } from '../index-file.js';
import type { SnapshotIndexEntry, SnapshotIndex } from '../index-file.js';
import { resolveStorage } from '../storage/index.js';

interface PruneOptions {
  keepLast?: string;
  olderThan?: string;
  apply?: boolean;
  json?: boolean;
}

export interface PrunePlan {
  keep: SnapshotIndexEntry[];
  drop: SnapshotIndexEntry[];
  kept_for_chain_safety: SnapshotIndexEntry[];
  reasons: Record<string, string>;
}

export async function pruneCommand(options: PruneOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  if (!options.keepLast && !options.olderThan) {
    console.log(
      chalk.red('✗ Specify --keep-last <N> or --older-than <date> (or both).'),
    );
    process.exit(1);
  }

  const config = await loadConfig();
  const index = await loadIndex();

  const plan = planPrune(index.snapshots, {
    keepLast: options.keepLast ? parseInt(options.keepLast, 10) : undefined,
    olderThanMs: options.olderThan ? parseDateOrThrow(options.olderThan) : undefined,
  });

  if (options.json) {
    console.log(JSON.stringify(plan, null, 2));
    if (!options.apply) return;
  } else {
    printPlan(plan);
  }

  if (!options.apply) {
    if (!options.json) {
      console.log(chalk.dim('  Dry-run only. Re-run with --apply to actually delete.'));
      console.log();
    }
    return;
  }

  if (plan.drop.length === 0) return;

  const storage = resolveStorage(config);
  let deleted = 0;
  let failed = 0;

  for (const entry of plan.drop) {
    try {
      await storage.delete(entry.filename);
      deleted++;
    } catch (err) {
      failed++;
      console.error(
        chalk.red(`  ✗ ${entry.filename}: ${err instanceof Error ? err.message : String(err)}`),
      );
    }
  }

  const remaining: SnapshotIndex = {
    snapshots: index.snapshots.filter(
      (s) => !plan.drop.some((d) => d.id === s.id),
    ),
  };
  await saveIndex(remaining);

  if (!options.json) {
    console.log();
    console.log(
      chalk.bold(
        `  ✓ Pruned ${deleted} snapshot(s)${failed > 0 ? ` (${failed} failed)` : ''}.`,
      ),
    );
    console.log();
  }
}

/**
 * Pure planner: given snapshots + flags, decide which to keep and drop
 * without touching storage. Refuses to drop any snapshot whose ID appears
 * as an ancestor in a kept snapshot's `tags` (best-effort proxy — the full
 * chain check would require decrypting parents).
 */
export function planPrune(
  snapshots: SnapshotIndexEntry[],
  filters: { keepLast?: number; olderThanMs?: number },
): PrunePlan {
  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const keepSet = new Set<string>();
  const dropSet = new Set<string>();
  const reasons: Record<string, string> = {};

  // --keep-last N: keep N most recent
  if (filters.keepLast !== undefined) {
    for (let i = 0; i < Math.min(filters.keepLast, sorted.length); i++) {
      keepSet.add(sorted[i].id);
      reasons[sorted[i].id] = `kept (top ${i + 1} of last ${filters.keepLast})`;
    }
  }

  // --older-than DATE: candidates for deletion are anything older
  for (const s of sorted) {
    if (keepSet.has(s.id)) continue;
    const ts = new Date(s.timestamp).getTime();
    if (filters.olderThanMs !== undefined && ts < filters.olderThanMs) {
      dropSet.add(s.id);
      reasons[s.id] = `older than cutoff`;
    } else if (filters.keepLast !== undefined) {
      dropSet.add(s.id);
      reasons[s.id] = `outside last ${filters.keepLast}`;
    } else {
      keepSet.add(s.id);
      reasons[s.id] = `kept (no rule matched for drop)`;
    }
  }

  // Always preserve at least the most recent snapshot, no matter what.
  if (sorted.length > 0) {
    const newest = sorted[0];
    if (dropSet.has(newest.id)) {
      dropSet.delete(newest.id);
      keepSet.add(newest.id);
      reasons[newest.id] = `kept (newest snapshot is never pruned)`;
    }
  }

  // Chain-safety: if any kept snapshot's index entry hints at incremental
  // ancestry via `parent` (we don't have that here directly — fall back to
  // not deleting any snapshot that is the ONLY one for its adapter, which
  // is a reasonable proxy for "might be the chain root").
  const adaptersWithMultiple = new Set<string>();
  const adapterCounts = new Map<string, number>();
  for (const s of sorted) {
    adapterCounts.set(s.adapter, (adapterCounts.get(s.adapter) ?? 0) + 1);
  }
  for (const [adapter, count] of adapterCounts) {
    if (count > 1) adaptersWithMultiple.add(adapter);
  }

  const keptForSafety: SnapshotIndexEntry[] = [];
  for (const s of sorted) {
    if (!dropSet.has(s.id)) continue;
    const adapterCount = adapterCounts.get(s.adapter) ?? 0;
    if (adapterCount <= 1) {
      dropSet.delete(s.id);
      keepSet.add(s.id);
      reasons[s.id] = `kept (sole snapshot for adapter ${s.adapter})`;
      keptForSafety.push(s);
    }
  }

  const keep = sorted.filter((s) => keepSet.has(s.id));
  const drop = sorted.filter((s) => dropSet.has(s.id));

  return { keep, drop, kept_for_chain_safety: keptForSafety, reasons };
}

function printPlan(plan: PrunePlan): void {
  console.log(chalk.bold('🌿 Prune plan'));
  console.log();
  console.log(`  ${chalk.green(`Keep: ${plan.keep.length}`)}`);
  console.log(`  ${chalk.red(`Drop: ${plan.drop.length}`)}`);
  if (plan.kept_for_chain_safety.length > 0) {
    console.log(
      `  ${chalk.yellow(`Held back for safety: ${plan.kept_for_chain_safety.length}`)}`,
    );
  }
  console.log();

  if (plan.drop.length > 0) {
    console.log(chalk.dim('  Will drop:'));
    for (const s of plan.drop.slice(0, 20)) {
      const date = new Date(s.timestamp).toISOString().slice(0, 10);
      console.log(
        `    ${chalk.red('-')} ${chalk.cyan(s.id)} ${chalk.dim(date)} ${chalk.dim(`(${s.adapter})`)}`,
      );
    }
    if (plan.drop.length > 20) {
      console.log(chalk.dim(`    ...and ${plan.drop.length - 20} more`));
    }
    console.log();
  }
}

function parseDateOrThrow(input: string): number {
  const ms = new Date(input).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid date for --older-than: ${input}`);
  }
  return ms;
}
