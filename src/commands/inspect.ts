/**
 * savestate inspect <snapshot-id> — Decrypt and summarize a snapshot.
 *
 * Read-only counterpart to `restore`: shows what's in a snapshot without
 * applying it. Useful for browsing history, debugging, and giving users
 * confidence in what their backups contain.
 */

import chalk from 'chalk';
import { isInitialized, loadConfig } from '../config.js';
import { findEntry, getLatestEntry, loadIndex } from '../index-file.js';
import { resolveStorage } from '../storage/index.js';
import { decrypt } from '../encryption.js';
import { unpackFromArchive, unpackSnapshot, snapshotFilename } from '../format.js';
import { isIncremental, reconstructFromChain } from '../incremental.js';
import { getPassphrase } from '../passphrase.js';

interface InspectOptions {
  json?: boolean;
  exclude?: string;
  since?: string;
  until?: string;
  tag?: string;
  label?: string;
}

const INSPECT_ADAPTERS = [
  'clawdbot',
  'claude-code',
  'claude-web',
  'openai-assistants',
  'chatgpt',
  'gemini',
  'cursor',
  'windsurf',
] as const;
const INSPECT_ADAPTER_LIST = INSPECT_ADAPTERS.join(', ');

export interface InspectJson {
  id: string;
  timestamp: string;
  platform: string;
  adapter: string;
  label: string | null;
  tags: string[];
  sizeBytes: number;
  parent: string | null;
  counts: {
    memories: number;
    conversations: number;
    knowledge: number;
    tools: number;
    skills: number;
    stateEvents: number;
  };
  hasIdentity: boolean;
  chainAncestors: number;
}

export function formatInspectJson(summary: InspectJson): string {
  return JSON.stringify(summary, null, 2);
}

export interface InspectMissingJson {
  found: false;
  id: string;
  timestamp: null;
  platform: null;
  hasIdentity: false;
}

export function formatInspectMissingJson(id: string): string {
  return JSON.stringify(
    {
      found: false,
      id,
      timestamp: null,
      platform: null,
      hasIdentity: false,
    },
    null,
    2,
  );
}

/** Parse inspect snapshot-id without decrypting archives for blank or comma-separated ids. */
export function parseInspectId(value: string | undefined): string {
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

/** Parse inspect --since without treating invalid dates as a missing snapshot. */
export function parseInspectSince(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid --since value "${value}". Expected an ISO 8601 date.`,
    );
  }
  return ms;
}

/** Parse inspect --until without treating invalid dates as a missing snapshot. */
export function parseInspectUntil(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid --until value "${value}". Expected an ISO 8601 date.`,
    );
  }
  return ms;
}

/** Parse inspect --tag without treating blank or comma-separated values as a missing snapshot. */
export function parseInspectTag(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const tag = value.trim();
  if (tag.length === 0 || tag.includes(',')) {
    throw new Error(
      `Invalid --tag value "${value}". Expected a single non-empty snapshot tag (no commas).`,
    );
  }

  return tag;
}

/** Parse inspect --label without treating blank or comma-separated values as a missing snapshot. */
export function parseInspectLabel(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const label = value.trim();
  if (label.length === 0 || label.includes(',')) {
    throw new Error(
      `Invalid --label value "${value}". Expected a single non-empty snapshot label (no commas).`,
    );
  }

  return label;
}

/** Parse inspect --exclude without treating unknown ids as a missing snapshot. */
export function parseInspectExclude(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;

  const adapters = value
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (
    adapters.length === 0 ||
    adapters.some((adapter) => !(INSPECT_ADAPTERS as readonly string[]).includes(adapter))
  ) {
    throw new Error(
      `Invalid --exclude value "${value}". Expected one or more of: ${INSPECT_ADAPTER_LIST}.`,
    );
  }

  return adapters;
}

/** Resolve inspect --exclude/--tag/--label/--since/--until (and snapshot id) to the newest matching snapshot. */
export function resolveInspectSnapshot(
  snapshots: Array<{ id: string; timestamp: string; adapter?: string; label?: string; tags?: string[] }>,
  options: { snapshot?: string; exclude?: string; label?: string; tag?: string; since?: string; until?: string },
): string | undefined {
  const snapshotId = parseInspectId(options.snapshot);
  const exclude = parseInspectExclude(options.exclude);
  const label = parseInspectLabel(options.label);
  const tag = parseInspectTag(options.tag);
  const since = parseInspectSince(options.since);
  const until = parseInspectUntil(options.until);
  if (
    exclude === undefined &&
    label === undefined &&
    tag === undefined &&
    since === undefined &&
    until === undefined
  ) {
    return snapshotId;
  }

  let matches = snapshots.filter((entry) => {
    if (exclude !== undefined && exclude.includes(entry.adapter ?? '')) return false;
    if (label !== undefined && entry.label !== label) return false;
    if (tag !== undefined && !(entry.tags ?? []).includes(tag)) return false;
    if (since !== undefined && new Date(entry.timestamp).getTime() < since) return false;
    if (until !== undefined && new Date(entry.timestamp).getTime() > until) return false;
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

export async function inspectCommand(rawSnapshotId: string, options: InspectOptions): Promise<void> {
  const snapshotId = parseInspectId(rawSnapshotId);
  const exclude = parseInspectExclude(options.exclude);
  const label = parseInspectLabel(options.label);
  const tag = parseInspectTag(options.tag);
  const since = parseInspectSince(options.since);
  const until = parseInspectUntil(options.until);

  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options.json) {
      console.log(formatInspectMissingJson(snapshotId));
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const storage = resolveStorage(config);

  let resolvedId = snapshotId;
  let filename: string;

  if (
    exclude !== undefined ||
    label !== undefined ||
    tag !== undefined ||
    since !== undefined ||
    until !== undefined
  ) {
    const matched = resolveInspectSnapshot((await loadIndex()).snapshots, {
      snapshot: rawSnapshotId,
      exclude: options.exclude,
      label: options.label,
      tag: options.tag,
      since: options.since,
      until: options.until,
    });
    if (!matched) {
      if (options.json) {
        console.log(formatInspectMissingJson(snapshotId));
        return;
      }
      console.log(chalk.red(`✗ Snapshot not found: ${options.exclude ?? label ?? tag ?? options.since ?? options.until}`));
      process.exit(1);
    }
    resolvedId = matched;
    const found = await findEntry(resolvedId);
    filename = found ? found.filename : snapshotFilename(resolvedId);
  } else if (snapshotId === 'latest') {
    const latest = await getLatestEntry();
    if (!latest) {
      if (options.json) {
        console.log(formatInspectMissingJson('latest'));
        return;
      }
      console.log(chalk.red('✗ No snapshots found.'));
      process.exit(1);
    }
    resolvedId = latest.id;
    filename = latest.filename;
  } else {
    const found = await findEntry(snapshotId);
    filename = found ? found.filename : snapshotFilename(snapshotId);
  }

  const passphrase = await getPassphrase();

  let encrypted: Buffer;
  try {
    encrypted = await storage.get(filename);
  } catch (err) {
    if (options.json) {
      console.log(formatInspectMissingJson(resolvedId));
      return;
    }
    console.log(chalk.red(`✗ Snapshot not found: ${filename}`));
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  let archive: Buffer;
  try {
    archive = await decrypt(encrypted, passphrase);
  } catch {
    console.log(chalk.red('✗ Decryption failed. Wrong passphrase or corrupted archive.'));
    process.exit(1);
  }

  let fileMap = await unpackFromArchive(archive);
  if (isIncremental(fileMap)) {
    fileMap = await reconstructFromChain(resolvedId, storage, passphrase);
  }
  const snapshot = unpackSnapshot(fileMap);

  const summary: InspectJson = {
    id: snapshot.manifest.id,
    timestamp: snapshot.manifest.timestamp,
    platform: snapshot.manifest.platform,
    adapter: snapshot.manifest.adapter,
    label: snapshot.manifest.label ?? null,
    tags: snapshot.manifest.tags ?? [],
    sizeBytes: snapshot.manifest.size,
    parent: snapshot.manifest.parent ?? null,
    counts: {
      memories: snapshot.memory.core.length,
      conversations: snapshot.conversations.total,
      knowledge: snapshot.memory.knowledge.length,
      tools: snapshot.identity.tools?.length ?? 0,
      skills: snapshot.identity.skills?.length ?? 0,
      stateEvents: snapshot.stateEvents?.count ?? 0,
    },
    hasIdentity: !!snapshot.identity.personality,
    chainAncestors: snapshot.chain.ancestors.length,
  };

  if (options.json) {
    console.log(formatInspectJson(summary));
    return;
  }

  console.log(chalk.bold(`📦 Snapshot ${chalk.cyan(summary.id)}`));
  console.log();
  printRow('Captured', formatDate(summary.timestamp));
  printRow('Platform', summary.platform);
  printRow('Adapter', summary.adapter);
  printRow('Size', formatBytes(summary.sizeBytes));
  if (summary.label) printRow('Label', summary.label);
  if (summary.tags.length > 0) printRow('Tags', summary.tags.join(', '));
  if (summary.parent) printRow('Parent', summary.parent);

  console.log();
  console.log(chalk.dim('  Contents:'));
  printRow('  Memories', String(summary.counts.memories));
  printRow('  Conversations', String(summary.counts.conversations));
  printRow('  Knowledge docs', String(summary.counts.knowledge));
  printRow('  Tools', String(summary.counts.tools));
  printRow('  Skills', String(summary.counts.skills));
  printRow('  State events', String(summary.counts.stateEvents));
  printRow('  Identity', summary.hasIdentity ? 'present' : 'absent');
  if (summary.chainAncestors > 0) {
    printRow('  Chain depth', `${summary.chainAncestors} ancestor(s)`);
  }
  console.log();
}

function printRow(label: string, value: string): void {
  console.log(`  ${chalk.dim(label.padEnd(18))} ${value}`);
}

function formatDate(iso: string): string {
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
