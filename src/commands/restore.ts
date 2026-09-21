/**
 * savestate restore [snapshot-id] — Restore from a snapshot
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, loadConfig } from '../config.js';
import { getLatestEntry, loadIndex } from '../index-file.js';
import { restoreSnapshot, type RestoreResult } from '../restore.js';
import { resolveStorage } from '../storage/resolve.js';
import { detectAdapter, getAdapter } from '../adapters/registry.js';
import { getPassphrase } from '../passphrase.js';

interface RestoreOptions {
  to?: string;
  dryRun?: boolean;
  include?: string;
  exclude?: string;
  tag?: string;
  label?: string;
  json?: boolean;
}

const VALID_INCLUDE = ['identity', 'memory', 'conversations'] as const;
type RestoreIncludeCategory = (typeof VALID_INCLUDE)[number];
const RESTORE_INCLUDE_LIST = VALID_INCLUDE.join(', ');
const RESTORE_ADAPTERS = [
  'clawdbot',
  'claude-code',
  'claude-web',
  'openai-assistants',
  'chatgpt',
  'gemini',
  'cursor',
  'windsurf',
] as const;
const RESTORE_ADAPTER_LIST = RESTORE_ADAPTERS.join(', ');

/** Parse restore snapshot-id without decrypting archives for blank or comma-separated ids. */
export function parseRestoreId(value: string | undefined): string {
  if (value === undefined) {
    return 'latest';
  }

  const id = value.trim();
  if (id.length === 0 || id.includes(',') || /\s/.test(id)) {
    throw new Error(
      `Invalid snapshot id "${value}". Expected a single non-empty snapshot id.`,
    );
  }

  return id;
}

/** Parse restore --to without treating unknown adapters as a process.exit. */
export function parseRestoreTo(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const adapter = value.trim().toLowerCase();
  if ((RESTORE_ADAPTERS as readonly string[]).includes(adapter)) {
    return adapter;
  }

  throw new Error(
    `Invalid --to value "${value}". Expected one of: ${RESTORE_ADAPTER_LIST}.`,
  );
}

/** Parse restore --include without silently restoring unknown categories. */
export function parseRestoreInclude(
  value: string | undefined,
): RestoreIncludeCategory[] | undefined {
  if (value === undefined) return undefined;

  const categories = value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  if (
    categories.length === 0 ||
    categories.some((token) => !(VALID_INCLUDE as readonly string[]).includes(token))
  ) {
    throw new Error(
      `Invalid --include value "${value}". Expected one or more of: ${RESTORE_INCLUDE_LIST}.`,
    );
  }

  return categories as RestoreIncludeCategory[];
}

/** Parse restore --exclude without silently skipping unknown categories. */
export function parseRestoreExclude(
  value: string | undefined,
): RestoreIncludeCategory[] | undefined {
  if (value === undefined) return undefined;

  const categories = value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  if (
    categories.length === 0 ||
    categories.some((token) => !(VALID_INCLUDE as readonly string[]).includes(token))
  ) {
    throw new Error(
      `Invalid --exclude value "${value}". Expected one or more of: ${RESTORE_INCLUDE_LIST}.`,
    );
  }

  return categories as RestoreIncludeCategory[];
}

/** Parse restore --tag without treating blank or comma-separated values as a missing snapshot. */
export function parseRestoreTag(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const tag = value.trim();
  if (tag.length === 0 || tag.includes(',')) {
    throw new Error(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  }

  return tag;
}

/** Parse restore --label without treating blank or comma-separated values as a missing snapshot. */
export function parseRestoreLabel(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const label = value.trim();
  if (label.length === 0 || label.includes(',')) {
    throw new Error(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  }

  return label;
}

/** Resolve restore --tag/--label (and optional snapshot id) to the newest matching snapshot. */
export function resolveRestoreSnapshot(
  snapshots: Array<{ id: string; timestamp: string; label?: string; tags?: string[] }>,
  options: { snapshot?: string; label?: string; tag?: string },
): string | undefined {
  const snapshotId = parseRestoreId(options.snapshot);
  const label = parseRestoreLabel(options.label);
  const tag = parseRestoreTag(options.tag);
  if (label === undefined && tag === undefined) {
    return snapshotId;
  }

  let matches = snapshots.filter((entry) => {
    if (label !== undefined && entry.label !== label) return false;
    if (tag !== undefined && !(entry.tags ?? []).includes(tag)) return false;
    return true;
  });
  if (snapshotId !== 'latest') {
    matches = matches.filter((entry) => entry.id === snapshotId);
  }

  matches = [...matches].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  return matches[0]?.id;
}

export function formatRestoreResultJson(result: RestoreResult, extra?: { dryRun?: boolean }): string {
  return JSON.stringify(
    {
      snapshotId: result.snapshotId,
      timestamp: result.timestamp,
      platform: result.platform,
      adapter: result.adapter,
      label: result.label ?? null,
      memoryCount: result.memoryCount,
      conversationCount: result.conversationCount,
      hasIdentity: result.hasIdentity,
      stateEventCount: result.stateEventCount,
      dryRun: extra?.dryRun ?? false,
    },
    null,
    2,
  );
}

export interface RestoreMissingJson {
  found: false;
  snapshotId: string;
  timestamp: null;
  platform: null;
  hasIdentity: false;
}

export function formatRestoreMissingJson(snapshotId: string): string {
  return JSON.stringify(
    {
      found: false,
      snapshotId,
      timestamp: null,
      platform: null,
      hasIdentity: false,
    },
    null,
    2,
  );
}

export async function restoreCommand(snapshotId: string | undefined, options: RestoreOptions): Promise<void> {
  const label = parseRestoreLabel(options.label);
  const tag = parseRestoreTag(options.tag);
  let resolvedId = parseRestoreId(snapshotId);

  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options.json) {
      console.log(formatRestoreMissingJson(resolvedId));
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const include = parseRestoreInclude(options.include);
  const exclude = parseRestoreExclude(options.exclude);
  const categories = exclude
    ? (include ?? [...VALID_INCLUDE]).filter((category) => !exclude.includes(category))
    : include;
  const to = parseRestoreTo(options.to);

  if (label !== undefined || tag !== undefined) {
    const matched = resolveRestoreSnapshot((await loadIndex()).snapshots, {
      snapshot: snapshotId,
      label: options.label,
      tag: options.tag,
    });
    if (!matched) {
      if (options.json) {
        console.log(formatRestoreMissingJson(resolvedId));
        return;
      }
      console.log(chalk.red(`✗ Snapshot not found: ${label ?? tag}`));
      process.exit(1);
    }
    resolvedId = matched;
  }

  if (options.json && resolvedId === 'latest') {
    const latest = await getLatestEntry();
    if (!latest) {
      console.log(formatRestoreMissingJson('latest'));
      return;
    }
  }

  const config = await loadConfig();

  if (!options.json) {
    console.log(chalk.bold(`🔄 Restoring from snapshot: ${chalk.cyan(resolvedId)}`));
    console.log();

    if (options.dryRun) {
      console.log(chalk.yellow('  ▸ DRY RUN — no changes will be made'));
      console.log();
    }
  }

  try {
    let adapter;
    if (to) {
      adapter = getAdapter(to);
      if (!adapter) {
        console.log(chalk.red(`✗ Unknown adapter: ${to}`));
        process.exit(1);
      }
    } else if (config.defaultAdapter) {
      adapter = getAdapter(config.defaultAdapter);
    } else {
      adapter = await detectAdapter();
    }

    if (!adapter) {
      console.log(chalk.red('✗ No adapter found. Specify one with --to or configure a default.'));
      process.exit(1);
    }

    const passphrase = await getPassphrase();
    const storage = resolveStorage(config);
    const spinner = options.json ? null : ora('Retrieving and decrypting snapshot...').start();

    const result = await restoreSnapshot(resolvedId, adapter, storage, passphrase, {
      include: categories,
      dryRun: options.dryRun,
    });

    if (options.json) {
      console.log(formatRestoreResultJson(result, { dryRun: options.dryRun }));
      return;
    }

    spinner?.succeed('Restore complete!');
    console.log();
    console.log(`  ${chalk.dim('Snapshot:')}      ${chalk.cyan(result.snapshotId)}`);
    console.log(`  ${chalk.dim('Timestamp:')}     ${result.timestamp}`);
    console.log(`  ${chalk.dim('Platform:')}      ${result.platform}`);
    console.log(`  ${chalk.dim('Adapter:')}       ${result.adapter}`);
    if (result.label) {
      console.log(`  ${chalk.dim('Label:')}         ${result.label}`);
    }
    console.log(`  ${chalk.dim('Identity:')}      ${result.hasIdentity ? chalk.green('✓ restored') : chalk.dim('not present')}`);
    console.log(`  ${chalk.dim('Memory:')}        ${result.memoryCount} entries restored`);
    console.log(`  ${chalk.dim('Conversations:')} ${result.conversationCount} indexed`);
    console.log();

    if (options.dryRun) {
      console.log(chalk.yellow('  This was a dry run. No files were modified.'));
    } else {
      console.log(chalk.green('  ✓ Your AI state has been restored.'));
      console.log(chalk.dim('  Existing files were backed up with .bak extension.'));
    }
    console.log();

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json && (message.startsWith('No snapshots found') || message.startsWith('Snapshot not found'))) {
      console.log(formatRestoreMissingJson(resolvedId));
      return;
    }
    console.error();
    console.error(chalk.red('✗ Restore failed'));
    console.error(chalk.red(message));
    process.exit(1);
  }
}
