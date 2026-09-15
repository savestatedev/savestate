/**
 * savestate snapshot — Capture current AI state to encrypted archive
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, loadConfig } from '../config.js';
import { detectAdapter, getAdapter } from '../adapters/registry.js';
import { createSnapshot, type CreateSnapshotResult } from '../snapshot.js';
import { resolveStorage } from '../storage/resolve.js';
import { getPassphrase } from '../passphrase.js';
import { parseTagString, parseMetaString, type StateEventInput } from '../state-events/types.js';
import { getGlobalStore, clearGlobalStore } from '../state-events/helpers.js';
import { parseScheduleEvery } from './schedule.js';

interface SnapshotOptions {
  label?: string;
  tags?: string;
  adapter?: string;
  schedule?: string;
  full?: boolean;
  /** Structured state entries (type:key=value) - Issue #91 */
  tag?: string[];
  /** Additional metadata for state entries (key=value) - Issue #91 */
  meta?: string[];
  json?: boolean;
}

const SNAPSHOT_ADAPTERS = [
  'clawdbot',
  'claude-code',
  'claude-web',
  'openai-assistants',
  'chatgpt',
  'gemini',
  'cursor',
  'windsurf',
] as const;
const SNAPSHOT_ADAPTER_LIST = SNAPSHOT_ADAPTERS.join(', ');

/** Parse snapshot --adapter without treating unknown ids as a missing snapshot. */
export function parseSnapshotAdapter(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const adapter = value.trim().toLowerCase();
  if ((SNAPSHOT_ADAPTERS as readonly string[]).includes(adapter)) {
    return adapter;
  }

  throw new Error(
    `Invalid --adapter value "${value}". Expected one of: ${SNAPSHOT_ADAPTER_LIST}.`,
  );
}

export function formatSnapshotResultJson(
  result: CreateSnapshotResult,
  extra?: { adapter?: string; storage?: string; stateEventCount?: number },
): string {
  return JSON.stringify(
    {
      snapshotId: result.snapshot.manifest.id,
      timestamp: result.snapshot.manifest.timestamp,
      platform: result.snapshot.manifest.platform,
      adapter: extra?.adapter ?? result.snapshot.manifest.adapter,
      label: result.snapshot.manifest.label ?? null,
      incremental: result.incremental,
      parent: result.snapshot.manifest.parent ?? null,
      fileCount: result.fileCount,
      archiveSize: result.archiveSize,
      encryptedSize: result.encryptedSize,
      storage: extra?.storage ?? null,
      stateEventCount: extra?.stateEventCount ?? 0,
      delta: result.delta
        ? {
            added: result.delta.added,
            modified: result.delta.modified,
            removed: result.delta.removed,
            unchanged: result.delta.unchanged,
            bytesSaved: result.delta.bytesSaved,
            chainDepth: result.delta.chainDepth,
          }
        : null,
    },
    null,
    2,
  );
}

export interface SnapshotMissingJson {
  found: false;
  adapter: string;
  snapshotId: null;
  timestamp: null;
  platform: null;
}

export function formatSnapshotMissingJson(adapter: string): string {
  return JSON.stringify(
    {
      found: false,
      adapter,
      snapshotId: null,
      timestamp: null,
      platform: null,
    },
    null,
    2,
  );
}

/** Parse snapshot --label without storing blank or comma-separated labels. */
export function parseSnapshotLabel(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const label = value.trim();
  if (label.length === 0 || label.includes(',')) {
    throw new Error(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  }

  return label;
}

/** Parse snapshot --tags without storing blank or empty comma-separated tags. */
export function parseSnapshotTags(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;

  const tags = value.split(',').map((token) => token.trim());
  if (tags.length === 0 || tags.some((token) => token.length === 0)) {
    throw new Error(
      `Invalid --tags value "${value}". Expected one or more non-empty snapshot tags (comma-separated).`,
    );
  }

  return tags;
}

/** Parse snapshot --schedule without suggesting an invalid interval. */
export function parseSnapshotSchedule(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  try {
    parseScheduleEvery(value);
  } catch {
    throw new Error(
      `Invalid --schedule value "${value}". Expected a duration like 1h, 6h, 12h, or 1d up to 7 days.`,
    );
  }

  return value.trim();
}

const SNAPSHOT_TAG_TYPES = ['decision', 'preference', 'error', 'api_response', 'custom'] as const;
const SNAPSHOT_TAG_TYPE_LIST = SNAPSHOT_TAG_TYPES.join(', ');

/** Parse snapshot --tag without recording a malformed state entry. */
export function parseSnapshotTag(value: string | undefined): StateEventInput | undefined {
  if (value === undefined) return undefined;

  const parsed = parseTagString(value.trim());
  const key = parsed?.key.trim() ?? '';
  const rawValue = parsed?.value;
  const eventValue = typeof rawValue === 'string' ? rawValue.trim() : rawValue;

  if (!parsed || key.length === 0 || eventValue === undefined || eventValue === '') {
    throw new Error(
      `Invalid --tag value "${value}". Expected type:key=value with type one of: ${SNAPSHOT_TAG_TYPE_LIST}.`,
    );
  }

  return {
    ...parsed,
    key,
    value: eventValue,
  };
}

export async function snapshotCommand(options: SnapshotOptions): Promise<void> {
  const label = parseSnapshotLabel(options.label);
  const adapterId = parseSnapshotAdapter(options.adapter);
  const tags = parseSnapshotTags(options.tags);
  const schedule = parseSnapshotSchedule(options.schedule);
  const stateEntries = (options.tag ?? [])
    .map((entry) => parseSnapshotTag(entry))
    .filter((entry): entry is StateEventInput => entry !== undefined);

  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options.json) {
      console.log(formatSnapshotMissingJson(adapterId ?? ''));
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  if (schedule) {
    console.log(chalk.cyan(`⏰ To set up scheduled backups, use:`));
    console.log();
    console.log(`   savestate schedule --every ${schedule}`);
    console.log();
    console.log(chalk.dim('   This creates a system job (launchd/systemd) for reliable auto-backups.'));
    console.log();
    return;
  }

  const config = await loadConfig();

  try {
    // Resolve adapter
    let adapter;
    if (adapterId) {
      adapter = getAdapter(adapterId);
      if (!adapter) {
        if (options.json) {
          console.log(formatSnapshotMissingJson(adapterId));
          return;
        }
        console.log(chalk.red(`✗ Unknown adapter: ${adapterId}`));
        process.exit(1);
      }
    } else if (config.defaultAdapter) {
      adapter = getAdapter(config.defaultAdapter);
    } else {
      adapter = await detectAdapter();
    }

    if (!adapter) {
      if (options.json) {
        console.log(formatSnapshotMissingJson(adapterId ?? config.defaultAdapter ?? ''));
        return;
      }
      console.log(chalk.red('✗ No adapter found. Specify one with --adapter or configure a default.'));
      process.exit(1);
    }

    // Get passphrase
    const passphrase = await getPassphrase();

    // Resolve storage backend
    const storage = resolveStorage(config);

    // Process state event tags (Issue #91)
    clearGlobalStore(); // Start with fresh store
    const stateEventStore = getGlobalStore();
    let stateEventCount = 0;

    if (stateEntries.length > 0) {
      // Parse global metadata first
      const globalMeta: Record<string, unknown> = {};
      if (options.meta && options.meta.length > 0) {
        for (const metaStr of options.meta) {
          const parsed = parseMetaString(metaStr);
          if (parsed) {
            globalMeta[parsed.key] = parsed.value;
          }
        }
      }

      for (const parsed of stateEntries) {
        stateEventStore.add({
          ...parsed,
          metadata: { ...globalMeta, ...parsed.metadata },
        });
        stateEventCount++;
      }
    }

    const spinner = options.json ? null : ora(`Extracting state via ${adapter.name} adapter...`).start();

    const result = await createSnapshot(adapter, storage, passphrase, {
      label,
      tags,
      full: options.full,
      stateEvents: stateEventCount > 0 ? stateEventStore : undefined,
    });

    if (options.json) {
      console.log(
        formatSnapshotResultJson(result, {
          adapter: adapter.name,
          storage: config.storage.type,
          stateEventCount,
        }),
      );
      return;
    }

    const typeLabel = result.incremental ? 'Incremental snapshot' : 'Full snapshot';
    spinner?.succeed(`${typeLabel} created!`);
    console.log();
    console.log(`  ${chalk.dim('ID:')}         ${chalk.cyan(result.snapshot.manifest.id)}`);
    console.log(`  ${chalk.dim('Adapter:')}    ${adapter.name}`);
    console.log(`  ${chalk.dim('Type:')}       ${result.incremental ? chalk.yellow('incremental (delta)') : chalk.blue('full')}`);
    if (label) {
      console.log(`  ${chalk.dim('Label:')}      ${label}`);
    }
    if (result.incremental && result.delta) {
      console.log(`  ${chalk.dim('Changes:')}    ${chalk.green(`+${result.delta.added}`)} added, ${chalk.yellow(`~${result.delta.modified}`)} modified, ${chalk.red(`-${result.delta.removed}`)} removed, ${chalk.dim(`${result.delta.unchanged} unchanged`)}`);
      console.log(`  ${chalk.dim('Chain:')}      depth ${result.delta.chainDepth} (parent: ${result.snapshot.manifest.parent})`);
      console.log(`  ${chalk.dim('Saved:')}      ${formatBytes(result.delta.bytesSaved)} vs full snapshot`);
    }
    console.log(`  ${chalk.dim('Files:')}      ${result.fileCount} files in archive`);
    console.log(`  ${chalk.dim('Archive:')}    ${formatBytes(result.archiveSize)}`);
    console.log(`  ${chalk.dim('Encrypted:')}  ${formatBytes(result.encryptedSize)}`);
    console.log(`  ${chalk.dim('Storage:')}    ${config.storage.type}`);
    if (stateEventCount > 0) {
      console.log(`  ${chalk.dim('State:')}      ${chalk.cyan(`${stateEventCount} event${stateEventCount === 1 ? '' : 's'}`)} recorded`);
    }
    console.log(`  ${chalk.dim('Status:')}     ${chalk.green('✓ Encrypted & stored')}`);
    console.log();
    console.log(chalk.dim(`  Restore with: savestate restore ${result.snapshot.manifest.id}`));
    console.log();

  } catch (err) {
    console.error();
    console.error(chalk.red('✗ Snapshot failed'));
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
