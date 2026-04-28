/**
 * savestate stats — Show usage statistics about your snapshots.
 *
 * Provides quick insight into how your AI state has evolved over time:
 * total snapshots, storage usage, adapter mix, cadence, and growth.
 */

import chalk from 'chalk';
import { isInitialized, loadConfig } from '../config.js';
import { loadIndex } from '../index-file.js';
import type { SnapshotIndexEntry } from '../index-file.js';

interface StatsOptions {
  json?: boolean;
}

export async function statsCommand(options: StatsOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const index = await loadIndex();
  const stats = computeStats(index.snapshots);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          ...stats,
          storage: { type: config.storage.type },
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(chalk.bold('📊 SaveState Stats'));
  console.log(chalk.dim(`   Storage: ${config.storage.type}`));
  console.log();

  if (stats.total === 0) {
    console.log(chalk.dim('  No snapshots yet. Create one with:'));
    console.log();
    console.log(`    ${chalk.cyan('savestate snapshot')}`);
    console.log();
    return;
  }

  printRow('Total snapshots', String(stats.total));
  printRow('Total size', formatBytes(stats.totalBytes));
  printRow('Average size', formatBytes(stats.avgBytes));
  printRow('Largest', formatBytes(stats.maxBytes));
  printRow('First snapshot', formatDate(stats.first ?? ''));
  printRow('Latest snapshot', formatDate(stats.latest ?? ''));
  if (stats.spanDays !== null) {
    printRow('Time covered', `${stats.spanDays} day${stats.spanDays === 1 ? '' : 's'}`);
  }
  if (stats.cadenceHours !== null) {
    printRow('Avg cadence', `${stats.cadenceHours.toFixed(1)}h between snapshots`);
  }

  console.log();
  console.log(chalk.dim('  By adapter:'));
  for (const [adapter, count] of Object.entries(stats.byAdapter)) {
    console.log(`    ${chalk.cyan(adapter.padEnd(20))} ${count}`);
  }

  if (Object.keys(stats.byPlatform).length > 1) {
    console.log();
    console.log(chalk.dim('  By platform:'));
    for (const [platform, count] of Object.entries(stats.byPlatform)) {
      console.log(`    ${chalk.cyan(platform.padEnd(20))} ${count}`);
    }
  }

  if (stats.tagCount > 0) {
    console.log();
    console.log(chalk.dim('  Top tags:'));
    for (const [tag, count] of stats.topTags) {
      console.log(`    ${chalk.cyan(tag.padEnd(20))} ${count}`);
    }
  }

  console.log();
}

interface ComputedStats {
  total: number;
  totalBytes: number;
  avgBytes: number;
  maxBytes: number;
  first: string | null;
  latest: string | null;
  spanDays: number | null;
  cadenceHours: number | null;
  byAdapter: Record<string, number>;
  byPlatform: Record<string, number>;
  tagCount: number;
  topTags: Array<[string, number]>;
}

export function computeStats(snapshots: SnapshotIndexEntry[]): ComputedStats {
  if (snapshots.length === 0) {
    return {
      total: 0,
      totalBytes: 0,
      avgBytes: 0,
      maxBytes: 0,
      first: null,
      latest: null,
      spanDays: null,
      cadenceHours: null,
      byAdapter: {},
      byPlatform: {},
      tagCount: 0,
      topTags: [],
    };
  }

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const first = sorted[0].timestamp;
  const latest = sorted[sorted.length - 1].timestamp;
  const totalBytes = sorted.reduce((sum, s) => sum + (s.size || 0), 0);
  const maxBytes = sorted.reduce((m, s) => Math.max(m, s.size || 0), 0);

  const byAdapter: Record<string, number> = {};
  const byPlatform: Record<string, number> = {};
  const tagCounts = new Map<string, number>();

  for (const s of sorted) {
    byAdapter[s.adapter] = (byAdapter[s.adapter] ?? 0) + 1;
    byPlatform[s.platform] = (byPlatform[s.platform] ?? 0) + 1;
    for (const tag of s.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const spanMs = new Date(latest).getTime() - new Date(first).getTime();
  const spanDays = spanMs > 0 ? Math.ceil(spanMs / (1000 * 60 * 60 * 24)) : null;
  const cadenceHours =
    sorted.length > 1 && spanMs > 0
      ? spanMs / (1000 * 60 * 60) / (sorted.length - 1)
      : null;

  return {
    total: sorted.length,
    totalBytes,
    avgBytes: Math.round(totalBytes / sorted.length),
    maxBytes,
    first,
    latest,
    spanDays,
    cadenceHours,
    byAdapter,
    byPlatform,
    tagCount: tagCounts.size,
    topTags,
  };
}

function printRow(label: string, value: string): void {
  console.log(`  ${chalk.dim(label.padEnd(18))} ${value}`);
}

function formatDate(iso: string): string {
  if (!iso) return '—';
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
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
