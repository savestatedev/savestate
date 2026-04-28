/**
 * savestate list — List all snapshots
 */

import chalk from 'chalk';
import { isInitialized, loadConfig } from '../config.js';
import { loadIndex } from '../index-file.js';

interface ListOptions {
  json?: boolean;
  limit?: string;
  since?: string;
  until?: string;
  adapter?: string;
  tag?: string;
}

export async function listCommand(options: ListOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const limit = options.limit ? parseInt(options.limit, 10) : 50;
  const index = await loadIndex();

  const filtered = applyListFilters(index.snapshots, options);

  if (options.json) {
    const output = filtered.slice(0, limit);
    console.log(JSON.stringify(output, null, 2));
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

import type { SnapshotIndexEntry } from '../index-file.js';

export function applyListFilters(
  snapshots: SnapshotIndexEntry[],
  options: { since?: string; until?: string; adapter?: string; tag?: string },
): SnapshotIndexEntry[] {
  const since = options.since ? parseDateOrThrow(options.since, '--since') : null;
  const until = options.until ? parseDateOrThrow(options.until, '--until') : null;

  return snapshots.filter((s) => {
    const ts = new Date(s.timestamp).getTime();
    if (since !== null && ts < since) return false;
    if (until !== null && ts > until) return false;
    if (options.adapter && s.adapter !== options.adapter) return false;
    if (options.tag && !(s.tags ?? []).includes(options.tag)) return false;
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
