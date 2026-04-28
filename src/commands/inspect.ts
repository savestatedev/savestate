/**
 * savestate inspect <snapshot-id> — Decrypt and summarize a snapshot.
 *
 * Read-only counterpart to `restore`: shows what's in a snapshot without
 * applying it. Useful for browsing history, debugging, and giving users
 * confidence in what their backups contain.
 */

import chalk from 'chalk';
import { isInitialized, loadConfig } from '../config.js';
import { findEntry, getLatestEntry } from '../index-file.js';
import { resolveStorage } from '../storage/index.js';
import { decrypt } from '../encryption.js';
import { unpackFromArchive, unpackSnapshot, snapshotFilename } from '../format.js';
import { isIncremental, reconstructFromChain } from '../incremental.js';
import { getPassphrase } from '../passphrase.js';

interface InspectOptions {
  json?: boolean;
}

export async function inspectCommand(snapshotId: string, options: InspectOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const storage = resolveStorage(config);

  let resolvedId = snapshotId;
  let filename: string;

  if (snapshotId === 'latest') {
    const latest = await getLatestEntry();
    if (!latest) {
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

  const summary = {
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
    console.log(JSON.stringify(summary, null, 2));
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
