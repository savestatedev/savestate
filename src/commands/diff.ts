/**
 * savestate diff <a> <b> — Compare two snapshots (Issue #92)
 *
 * Generates semantic diffs for agent identity and state events.
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, loadConfig } from '../config.js';
import { resolveStorage } from '../storage/resolve.js';
import { getPassphrase } from '../passphrase.js';
import { findEntry, loadIndex } from '../index-file.js';
import { decrypt } from '../encryption.js';
import { unpackFromArchive, unpackSnapshot, snapshotFilename } from '../format.js';
import { isIncremental, reconstructFromChain } from '../incremental.js';
import { loadIdentityFromArchive } from '../identity/store.js';
import { diffIdentity, formatIdentityDiff, type IdentityDiff } from '../diff/semantic.js';
import { diffStateEvents, formatStateEventDiff, type StateEventChange, type StateEventDiff } from '../diff/state-events.js';
import type { Snapshot } from '../types.js';
import type { AgentIdentity } from '../identity/schema.js';

interface DiffOptions {
  json?: boolean;
  adapter?: string;
  exclude?: string;
  since?: string;
  until?: string;
  tag?: string;
  label?: string;
  limit?: string;
  offset?: string;
}

const DIFF_ADAPTERS = [
  'clawdbot',
  'claude-code',
  'claude-web',
  'openai-assistants',
  'chatgpt',
  'gemini',
  'cursor',
  'windsurf',
] as const;
const DIFF_ADAPTER_LIST = DIFF_ADAPTERS.join(', ');

export interface DiffJson {
  snapshotA: string;
  snapshotB: string;
  identity: {
    hasChanges: boolean;
    changes: IdentityDiff['changes'];
    summary: IdentityDiff['summary'];
    versionChange: IdentityDiff['versionChange'];
  };
  state: {
    hasChanges: boolean;
    byType: Record<string, StateEventChange[]>;
    summary: StateEventDiff['summary'];
    memoryTierChanges: StateEventDiff['memoryTierChanges'];
  };
}

export function formatDiffJson(
  snapshotA: string,
  snapshotB: string,
  identityDiff: IdentityDiff,
  stateDiff: StateEventDiff,
): string {
  const record: DiffJson = {
    snapshotA,
    snapshotB,
    identity: {
      hasChanges: identityDiff.hasChanges,
      changes: identityDiff.changes,
      summary: identityDiff.summary,
      versionChange: identityDiff.versionChange,
    },
    state: {
      hasChanges: stateDiff.hasChanges,
      byType: Object.fromEntries(stateDiff.byType),
      summary: stateDiff.summary,
      memoryTierChanges: stateDiff.memoryTierChanges,
    },
  };
  return JSON.stringify(record, null, 2);
}

export interface DiffMissingJson {
  found: false;
  snapshotA: string;
  snapshotB: string;
  hasChanges: false;
}

export function formatDiffMissingJson(snapshotA: string, snapshotB: string): string {
  return JSON.stringify(
    {
      found: false,
      snapshotA,
      snapshotB,
      hasChanges: false,
    },
    null,
    2,
  );
}

/** Parse a diff snapshot id without decrypting archives for blank or comma-separated ids. */
export function parseDiffId(value: string | undefined): string {
  if (value === undefined) {
    throw new Error(
      'Invalid snapshot id. Expected a single non-empty snapshot id.',
    );
  }

  const id = value.trim();
  if (id.length === 0 || id.includes(',') || /\s/.test(id)) {
    throw new Error(
      `Invalid snapshot id "${value}". Expected a single non-empty snapshot id.`,
    );
  }

  return id;
}

/** Parse diff --adapter without treating unknown ids as a missing snapshot. */
export function parseDiffAdapter(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const adapter = value.trim().toLowerCase();
  if ((DIFF_ADAPTERS as readonly string[]).includes(adapter)) {
    return adapter;
  }

  throw new Error(
    `Invalid --adapter value "${value}". Expected one of: ${DIFF_ADAPTER_LIST}.`,
  );
}

/** Parse diff --since without treating invalid dates as a missing snapshot. */
export function parseDiffSince(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid --since value "${value}". Expected an ISO 8601 date.`,
    );
  }
  return ms;
}

/** Parse diff --until without treating invalid dates as a missing snapshot. */
export function parseDiffUntil(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid --until value "${value}". Expected an ISO 8601 date.`,
    );
  }
  return ms;
}

const MAX_DIFF_LIMIT = 1000;
const MAX_DIFF_OFFSET = 1000;

/** Parse diff --limit without treating invalid counts as a missing snapshot. */
export function parseDiffLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_DIFF_LIMIT}.`,
    );
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_DIFF_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_DIFF_LIMIT}.`,
    );
  }
  return limit;
}

/** Parse diff --offset without treating invalid skips as a missing snapshot. */
export function parseDiffOffset(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_DIFF_OFFSET}.`,
    );
  }

  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_DIFF_OFFSET) {
    throw new Error(
      `Invalid --offset value "${value}". Expected a non-negative integer up to ${MAX_DIFF_OFFSET}.`,
    );
  }
  return offset;
}

/** Skip the first N snapshots when diff --offset is set. */
export function selectDiffOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}

/** Parse diff --exclude without treating unknown ids as a missing snapshot. */
export function parseDiffExclude(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;

  const adapters = value
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (
    adapters.length === 0 ||
    adapters.some((adapter) => !(DIFF_ADAPTERS as readonly string[]).includes(adapter))
  ) {
    throw new Error(
      `Invalid --exclude value "${value}". Expected one or more of: ${DIFF_ADAPTER_LIST}.`,
    );
  }

  return adapters;
}

/** Parse diff --tag without treating blank or comma-separated values as a missing snapshot. */
export function parseDiffTag(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const tag = value.trim();
  if (tag.length === 0 || tag.includes(',')) {
    throw new Error(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  }

  return tag;
}

/** Parse diff --label without treating blank or comma-separated values as a missing snapshot. */
export function parseDiffLabel(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const label = value.trim();
  if (label.length === 0 || label.includes(',')) {
    throw new Error(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  }

  return label;
}

/** Resolve diff --adapter/--exclude/--since/--until/--tag/--label/--limit/--offset (and snapshot id) to the newest matching snapshot. */
export function resolveDiffSnapshot(
  snapshots: Array<{ id: string; timestamp: string; adapter?: string; label?: string; tags?: string[] }>,
  options: { snapshot: string; adapter?: string; exclude?: string; since?: string; until?: string; tag?: string; label?: string; limit?: string; offset?: string },
): string | undefined {
  const snapshotId = parseDiffId(options.snapshot);
  const adapter = parseDiffAdapter(options.adapter);
  const exclude = parseDiffExclude(options.exclude);
  const since = parseDiffSince(options.since);
  const until = parseDiffUntil(options.until);
  const tag = parseDiffTag(options.tag);
  const label = parseDiffLabel(options.label);
  const limit = parseDiffLimit(options.limit);
  const offset = parseDiffOffset(options.offset);
  if (
    adapter === undefined &&
    exclude === undefined &&
    since === undefined &&
    until === undefined &&
    tag === undefined &&
    label === undefined &&
    limit === undefined &&
    offset === undefined
  ) {
    return snapshotId;
  }

  let matches = snapshots.filter((entry) => {
    if (adapter !== undefined && entry.adapter !== adapter) return false;
    if (exclude !== undefined && exclude.includes(entry.adapter ?? '')) return false;
    if (since !== undefined && new Date(entry.timestamp).getTime() < since) return false;
    if (tag !== undefined && !(entry.tags ?? []).includes(tag)) return false;
    if (label !== undefined && entry.label !== label) return false;
    if (until !== undefined && new Date(entry.timestamp).getTime() > until) return false;
    return true;
  });

  matches = selectDiffOffsetEntries(
    [...matches].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    ),
    offset,
  );
  if (limit !== undefined) {
    matches = matches.slice(0, limit);
  }
  if (snapshotId !== 'latest') {
    matches = matches.filter((entry) => entry.id === snapshotId);
  }
  return matches[0]?.id;
}

export async function diffCommand(
  rawSnapshotA: string,
  rawSnapshotB: string,
  options?: DiffOptions,
): Promise<void> {
  let snapshotA = parseDiffId(rawSnapshotA);
  let snapshotB = parseDiffId(rawSnapshotB);
  const adapter = parseDiffAdapter(options?.adapter);
  const exclude = parseDiffExclude(options?.exclude);
  const since = parseDiffSince(options?.since);
  const tag = parseDiffTag(options?.tag);
  const label = parseDiffLabel(options?.label);
  const until = parseDiffUntil(options?.until);
  const limit = parseDiffLimit(options?.limit);
  const offset = parseDiffOffset(options?.offset);

  if (!options?.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options?.json) {
      console.log(formatDiffMissingJson(snapshotA, snapshotB));
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  if (
    adapter !== undefined ||
    exclude !== undefined ||
    since !== undefined ||
    until !== undefined ||
    tag !== undefined ||
    label !== undefined ||
    limit !== undefined ||
    offset !== undefined
  ) {
    const snapshots = (await loadIndex()).snapshots;
    const matchedA = resolveDiffSnapshot(snapshots, {
      snapshot: rawSnapshotA,
      adapter: options?.adapter,
      exclude: options?.exclude,
      since: options?.since,
      tag: options?.tag,
      label: options?.label,
      until: options?.until,
      limit: options?.limit,
      offset: options?.offset,
    });
    const matchedB = resolveDiffSnapshot(snapshots, {
      snapshot: rawSnapshotB,
      adapter: options?.adapter,
      exclude: options?.exclude,
      since: options?.since,
      tag: options?.tag,
      label: options?.label,
      until: options?.until,
      limit: options?.limit,
      offset: options?.offset,
    });
    if (!matchedA || !matchedB) {
      if (options?.json) {
        console.log(formatDiffMissingJson(snapshotA, snapshotB));
        return;
      }
      console.log(chalk.red(`✗ Snapshot not found: ${adapter ?? exclude?.join(',') ?? options?.since ?? options?.until ?? options?.tag ?? label ?? options?.limit ?? options?.offset}`));
      process.exit(1);
    }
    snapshotA = matchedA;
    snapshotB = matchedB;
  }

  if (!options?.json) {
    console.log(chalk.bold('Comparing snapshots'));
    console.log(`   ${chalk.cyan(snapshotA)} ↔ ${chalk.cyan(snapshotB)}`);
    console.log();
  }

  const spinner = options?.json ? null : ora('Loading and decrypting snapshots...').start();

  try {
    const config = await loadConfig();
    const storage = resolveStorage(config);
    const passphrase = await getPassphrase();

    // Load both snapshots
    if (spinner) spinner.text = `Loading snapshot ${snapshotA}...`;
    const { snapshot: snapA, identity: identityA } = await loadSnapshotWithIdentity(
      snapshotA,
      storage,
      passphrase,
    );

    if (spinner) spinner.text = `Loading snapshot ${snapshotB}...`;
    const { snapshot: snapB, identity: identityB } = await loadSnapshotWithIdentity(
      snapshotB,
      storage,
      passphrase,
    );

    if (spinner) spinner.text = 'Computing semantic diff...';

    // Compute diffs
    const identityDiff = diffIdentity(identityA, identityB);
    const stateDiff = diffStateEvents(snapA, snapB);

    spinner?.succeed('Diff complete');
    if (!options?.json) {
      console.log();
    }

    if (options?.json) {
      console.log(formatDiffJson(snapshotA, snapshotB, identityDiff, stateDiff));
      return;
    }

    // Human-readable output

    // Identity diff section
    if (identityDiff.hasChanges) {
      console.log(chalk.bold.cyan('Agent Identity Changes:'));
      if (identityDiff.versionChange) {
        console.log(
          chalk.dim('  Version:') +
            ` ${identityDiff.versionChange.before || '(none)'} → ${identityDiff.versionChange.after || '(none)'}`,
        );
      }
      for (const change of identityDiff.changes) {
        const symbol = getChangeSymbol(change.type);
        const color = getChangeColor(change.type);
        console.log(color(`  ${symbol} ${formatChangeDescription(change)}`));
      }
      console.log();
    } else {
      console.log(chalk.dim('  No identity changes.'));
      console.log();
    }

    // State events diff section
    if (stateDiff.hasChanges) {
      console.log(chalk.bold.cyan('State Changes:'));

      // Display by type in a specific order
      const typeOrder = [
        'decision',
        'preference',
        'error',
        'api_response',
        'memory',
        'conversation',
        'knowledge',
      ] as const;

      const typeLabels: Record<string, string> = {
        decision: 'Decisions',
        preference: 'Preferences',
        error: 'Errors',
        api_response: 'API Responses',
        memory: 'Memories',
        conversation: 'Conversations',
        knowledge: 'Knowledge',
      };

      for (const type of typeOrder) {
        const changes = stateDiff.byType.get(type);
        if (!changes || changes.length === 0) continue;

        const added = changes.filter((c) => c.operation === 'added').length;
        const removed = changes.filter((c) => c.operation === 'removed').length;
        const modified = changes.filter((c) => c.operation === 'modified').length;

        const counts: string[] = [];
        if (added > 0) counts.push(chalk.green(`${added} new`));
        if (removed > 0) counts.push(chalk.red(`${removed} removed`));
        if (modified > 0) counts.push(chalk.yellow(`${modified} modified`));

        console.log(`  ${chalk.bold(typeLabels[type])} (${counts.join(', ')}):`);

        // Show up to 5 examples per type
        const examples = changes.slice(0, 5);
        for (const change of examples) {
          const symbol = getChangeSymbol(change.operation);
          const color = getChangeColor(change.operation);
          console.log(color(`    ${symbol} ${formatStateDescription(change)}`));
        }

        if (changes.length > 5) {
          console.log(chalk.dim(`    ... and ${changes.length - 5} more`));
        }
      }

      // Show memory tier changes if any
      if (stateDiff.memoryTierChanges) {
        const tc = stateDiff.memoryTierChanges;
        const tierChanges: string[] = [];
        if (tc.promoted > 0) tierChanges.push(`${tc.promoted} promoted`);
        if (tc.demoted > 0) tierChanges.push(`${tc.demoted} demoted`);
        if (tc.pinned > 0) tierChanges.push(`${tc.pinned} pinned`);
        if (tc.unpinned > 0) tierChanges.push(`${tc.unpinned} unpinned`);

        if (tierChanges.length > 0) {
          console.log();
          console.log(chalk.dim(`  Memory Tiers: ${tierChanges.join(', ')}`));
        }
      }

      console.log();
    } else {
      console.log(chalk.dim('  No state changes.'));
      console.log();
    }

    // Summary
    const totalAdded = identityDiff.summary.added + stateDiff.summary.added;
    const totalRemoved = identityDiff.summary.removed + stateDiff.summary.removed;
    const totalModified = identityDiff.summary.modified + stateDiff.summary.modified;

    console.log(
      chalk.bold('Summary:') +
        ` ${chalk.green(`+${totalAdded}`)} added, ` +
        `${chalk.red(`-${totalRemoved}`)} removed, ` +
        `${chalk.yellow(`~${totalModified}`)} modified`,
    );
    console.log();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (options?.json && message.startsWith('Snapshot not found')) {
      console.log(formatDiffMissingJson(snapshotA, snapshotB));
      return;
    }
    spinner?.fail('Diff failed');
    console.error(chalk.red(message));
    process.exit(1);
  }
}

/**
 * Load a snapshot and extract its identity document.
 */
async function loadSnapshotWithIdentity(
  snapshotId: string,
  storage: { get: (key: string) => Promise<Buffer> },
  passphrase: string,
): Promise<{ snapshot: Snapshot; identity?: AgentIdentity }> {
  // Resolve snapshot ID to filename
  const entry = await findEntry(snapshotId);
  const filename = entry?.filename ?? snapshotFilename(snapshotId);

  // Retrieve from storage
  let encrypted: Buffer;
  try {
    encrypted = await storage.get(filename);
  } catch {
    throw new Error(`Snapshot not found in storage: ${snapshotId}`);
  }

  // Decrypt
  let archive: Buffer;
  try {
    archive = await decrypt(encrypted, passphrase);
  } catch (err) {
    if (err instanceof Error && err.message.includes('GCM')) {
      throw new Error('Wrong passphrase or corrupted archive.');
    }
    throw err;
  }

  // Unpack
  let fileMap = await unpackFromArchive(archive);

  // If incremental, reconstruct full state from chain
  if (isIncremental(fileMap)) {
    fileMap = await reconstructFromChain(snapshotId, storage as any, passphrase);
  }

  const snapshot = unpackSnapshot(fileMap);
  const identity = loadIdentityFromArchive(fileMap);

  return { snapshot, identity };
}

/**
 * Get the symbol for a change type.
 */
function getChangeSymbol(type: string): string {
  switch (type) {
    case 'added':
      return '+';
    case 'removed':
      return '-';
    case 'modified':
      return '~';
    default:
      return '?';
  }
}

/**
 * Get the chalk color for a change type.
 */
function getChangeColor(type: string): (text: string) => string {
  switch (type) {
    case 'added':
      return chalk.green;
    case 'removed':
      return chalk.red;
    case 'modified':
      return chalk.yellow;
    default:
      return chalk.white;
  }
}

/**
 * Format an identity change for display.
 */
function formatChangeDescription(change: { field: string; before?: unknown; after?: unknown; type: string }): string {
  const truncate = (val: unknown, max = 40): string => {
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    if (str.length <= max) return str;
    return str.slice(0, max - 3) + '...';
  };

  if (change.type === 'added') {
    return `${change.field}: "${truncate(change.after)}"`;
  } else if (change.type === 'removed') {
    return `${change.field}: "${truncate(change.before)}"`;
  } else {
    return `${change.field}: "${truncate(change.before)}" → "${truncate(change.after)}"`;
  }
}

/**
 * Format a state event change for display.
 */
function formatStateDescription(change: { description: string }): string {
  // Remove leading +/- symbols if present (we add our own)
  return change.description.replace(/^[+\-~]\s*/, '');
}
