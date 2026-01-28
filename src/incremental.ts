/**
 * SaveState Incremental Snapshots
 *
 * Instead of storing a full copy every time, incremental snapshots
 * only capture what changed since the parent snapshot.
 *
 * How it works:
 * 1. Hash every file in the current snapshot (SHA-256)
 * 2. Load the parent snapshot's content hashes
 * 3. Compare: identify added, modified, removed files
 * 4. Store only the delta (changed + added files)
 * 5. On restore: reconstruct by applying deltas from base → current
 *
 * The delta manifest tracks the relationship:
 * ```
 * base (full) → delta-1 → delta-2 → delta-3 (current)
 * ```
 *
 * Every Nth snapshot (configurable, default 10) forces a full snapshot
 * to keep the chain short and restore fast.
 */

import { createHash } from 'node:crypto';
import type { Snapshot, StorageBackend } from './types.js';
import { packSnapshot, packToArchive, unpackFromArchive, unpackSnapshot } from './format.js';
import { encrypt, decrypt } from './encryption.js';
import { findEntry, loadIndex } from './index-file.js';

// ─── Types ───────────────────────────────────────────────────

/** Hash of every file in a snapshot */
export interface ContentHashes {
  /** Map of relative path → SHA-256 hash */
  files: Record<string, string>;
  /** Total number of files */
  count: number;
  /** Combined hash of all file hashes (for quick comparison) */
  rootHash: string;
}

/** A single file change in a delta */
export interface DeltaEntry {
  /** Relative path within the archive */
  path: string;
  /** Type of change */
  type: 'added' | 'modified' | 'removed';
  /** SHA-256 hash of the new content (absent for 'removed') */
  hash?: string;
  /** Size in bytes of the new content (absent for 'removed') */
  size?: number;
}

/** The delta manifest stored inside incremental archives */
export interface DeltaManifest {
  /** ID of the parent snapshot this delta is relative to */
  parentId: string;
  /** ID of the base (full) snapshot at the root of the chain */
  baseId: string;
  /** Position in the chain (0 = full snapshot, 1 = first delta, etc.) */
  chainDepth: number;
  /** Content hashes of the FULL resulting state after applying this delta */
  resultHashes: ContentHashes;
  /** Individual file changes */
  entries: DeltaEntry[];
  /** Summary stats */
  stats: {
    added: number;
    modified: number;
    removed: number;
    unchanged: number;
    totalFiles: number;
    /** Bytes saved vs full snapshot */
    bytesSaved: number;
  };
}

/** Result of computing a delta between two snapshots */
export interface DeltaResult {
  /** The delta manifest */
  delta: DeltaManifest;
  /** Map of changed file paths → content (only added + modified) */
  changedFiles: Map<string, Buffer>;
  /** Whether a full snapshot should be forced (chain too deep or too much changed) */
  shouldForceFull: boolean;
}

// ─── Configuration ───────────────────────────────────────────

/** Max chain depth before forcing a full snapshot */
export const MAX_CHAIN_DEPTH = 10;

/** If more than this fraction of files changed, just do a full snapshot */
export const FULL_SNAPSHOT_THRESHOLD = 0.7;

// ─── Content Hashing ─────────────────────────────────────────

/**
 * Compute SHA-256 hashes for every file in a packed snapshot.
 */
export function computeContentHashes(files: Map<string, Buffer>): ContentHashes {
  const hashes: Record<string, string> = {};

  for (const [path, data] of files) {
    hashes[path] = createHash('sha256').update(data).digest('hex');
  }

  // Root hash = hash of all sorted path:hash pairs
  const sortedPairs = Object.entries(hashes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([p, h]) => `${p}:${h}`)
    .join('\n');

  const rootHash = createHash('sha256').update(sortedPairs).digest('hex');

  return {
    files: hashes,
    count: Object.keys(hashes).length,
    rootHash,
  };
}

// ─── Delta Computation ───────────────────────────────────────

/**
 * Compute the delta between the current snapshot files and a parent's content hashes.
 *
 * @param currentFiles - The full file map of the current snapshot
 * @param parentHashes - Content hashes from the parent snapshot
 * @param parentId - ID of the parent snapshot
 * @param baseId - ID of the base (full) snapshot
 * @param chainDepth - Current position in the chain
 * @returns The computed delta and changed files
 */
export function computeDelta(
  currentFiles: Map<string, Buffer>,
  parentHashes: ContentHashes,
  parentId: string,
  baseId: string,
  chainDepth: number,
): DeltaResult {
  const currentHashes = computeContentHashes(currentFiles);
  const changedFiles = new Map<string, Buffer>();
  const entries: DeltaEntry[] = [];

  let added = 0;
  let modified = 0;
  let removed = 0;
  let unchanged = 0;
  let changedBytes = 0;
  let totalBytes = 0;

  // Check each current file against parent
  for (const [path, data] of currentFiles) {
    totalBytes += data.length;
    const currentHash = currentHashes.files[path];
    const parentHash = parentHashes.files[path];

    if (!parentHash) {
      // New file
      entries.push({ path, type: 'added', hash: currentHash, size: data.length });
      changedFiles.set(path, data);
      changedBytes += data.length;
      added++;
    } else if (currentHash !== parentHash) {
      // Modified file
      entries.push({ path, type: 'modified', hash: currentHash, size: data.length });
      changedFiles.set(path, data);
      changedBytes += data.length;
      modified++;
    } else {
      unchanged++;
    }
  }

  // Check for removed files (in parent but not in current)
  for (const path of Object.keys(parentHashes.files)) {
    if (!currentFiles.has(path)) {
      entries.push({ path, type: 'removed' });
      removed++;
    }
  }

  const totalFiles = currentFiles.size;
  const changedCount = added + modified + removed;
  const changeRatio = totalFiles > 0 ? changedCount / totalFiles : 0;

  // Should we force a full snapshot?
  const shouldForceFull =
    chainDepth >= MAX_CHAIN_DEPTH || changeRatio >= FULL_SNAPSHOT_THRESHOLD;

  const delta: DeltaManifest = {
    parentId,
    baseId,
    chainDepth,
    resultHashes: currentHashes,
    entries,
    stats: {
      added,
      modified,
      removed,
      unchanged,
      totalFiles,
      bytesSaved: totalBytes - changedBytes,
    },
  };

  return { delta, changedFiles, shouldForceFull };
}

// ─── Packing Incremental Archives ────────────────────────────

/**
 * Pack an incremental snapshot (delta only).
 * The archive contains:
 * - manifest.json (with parent reference)
 * - meta/delta-manifest.json (the delta details)
 * - meta/snapshot-chain.json (chain info)
 * - Only the changed/added files (same paths as full snapshot)
 */
export function packDelta(
  snapshot: Snapshot,
  delta: DeltaManifest,
  changedFiles: Map<string, Buffer>,
): Map<string, Buffer> {
  const files = new Map<string, Buffer>();

  // Always include manifest and meta
  files.set('manifest.json', Buffer.from(JSON.stringify(snapshot.manifest, null, 2)));
  files.set('meta/delta-manifest.json', Buffer.from(JSON.stringify(delta, null, 2)));
  files.set('meta/platform.json', Buffer.from(JSON.stringify(snapshot.platform, null, 2)));
  files.set('meta/snapshot-chain.json', Buffer.from(JSON.stringify(snapshot.chain, null, 2)));
  files.set('meta/restore-hints.json', Buffer.from(JSON.stringify(snapshot.restoreHints, null, 2)));

  // Include only changed/added files
  for (const [path, data] of changedFiles) {
    files.set(path, data);
  }

  return files;
}

// ─── Reconstruction ──────────────────────────────────────────

/**
 * Reconstruct a full snapshot by walking the chain from base to current.
 *
 * Starting from the base (full) snapshot, applies each delta in order:
 * 1. Load base snapshot → full file map
 * 2. For each delta in the chain:
 *    a. Add/overwrite files from the delta
 *    b. Remove files marked as 'removed'
 * 3. Return the reconstructed full file map
 *
 * @param snapshotId - The target snapshot to reconstruct
 * @param storage - Storage backend
 * @param passphrase - Decryption passphrase
 * @returns Reconstructed full file map
 */
export async function reconstructFromChain(
  snapshotId: string,
  storage: StorageBackend,
  passphrase: string,
): Promise<Map<string, Buffer>> {
  // Build the chain: walk backwards from snapshotId to find the base
  const chain = await buildChain(snapshotId, storage, passphrase);

  if (chain.length === 0) {
    throw new Error(`Could not build snapshot chain for ${snapshotId}`);
  }

  // chain[0] is the base (full) snapshot, chain[n-1] is the target
  // Start with the base's full file map
  const baseArchive = chain[0];
  const files = new Map<string, Buffer>(baseArchive.files);

  // Apply each delta in order
  for (let i = 1; i < chain.length; i++) {
    const { files: deltaFiles, delta } = chain[i];

    if (!delta) {
      // This is a full snapshot in the middle of the chain (shouldn't happen normally)
      files.clear();
      for (const [path, data] of deltaFiles) {
        files.set(path, data);
      }
      continue;
    }

    // Apply additions and modifications
    for (const [path, data] of deltaFiles) {
      // Skip meta files — they're delta-specific
      if (path === 'meta/delta-manifest.json') continue;
      files.set(path, data);
    }

    // Apply removals
    for (const entry of delta.entries) {
      if (entry.type === 'removed') {
        files.delete(entry.path);
      }
    }
  }

  return files;
}

/** A link in the snapshot chain */
interface ChainLink {
  id: string;
  files: Map<string, Buffer>;
  delta?: DeltaManifest;
}

/**
 * Build the full chain from base to the given snapshot.
 * Returns an ordered array: [base, delta1, delta2, ..., target]
 */
async function buildChain(
  snapshotId: string,
  storage: StorageBackend,
  passphrase: string,
): Promise<ChainLink[]> {
  const links: ChainLink[] = [];
  let currentId: string | undefined = snapshotId;
  const visited = new Set<string>();

  // Walk backwards collecting snapshots
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);

    const entry = await findEntry(currentId);
    if (!entry) {
      throw new Error(`Snapshot not found in index: ${currentId}`);
    }

    const encrypted = await storage.get(entry.filename);
    const archive = await decrypt(encrypted, passphrase);
    const files = await unpackFromArchive(archive);

    // Check if this is a delta or full snapshot
    const deltaManifestBuf = files.get('meta/delta-manifest.json');
    let delta: DeltaManifest | undefined;

    if (deltaManifestBuf) {
      delta = JSON.parse(deltaManifestBuf.toString('utf-8')) as DeltaManifest;
      links.unshift({ id: currentId, files, delta });
      currentId = delta.parentId;
    } else {
      // Full snapshot — this is the base
      links.unshift({ id: currentId, files, delta: undefined });
      currentId = undefined; // Stop walking
    }
  }

  return links;
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Get content hashes for the latest snapshot (used as parent for incremental).
 * Returns null if no previous snapshots exist.
 */
export async function getParentHashes(
  storage: StorageBackend,
  passphrase: string,
): Promise<{
  hashes: ContentHashes;
  parentId: string;
  baseId: string;
  chainDepth: number;
} | null> {
  const { getLatestEntry } = await import('./index-file.js');
  const latest = await getLatestEntry();
  if (!latest) return null;

  try {
    const encrypted = await storage.get(latest.filename);
    const archive = await decrypt(encrypted, passphrase);
    const files = await unpackFromArchive(archive);

    // Check if the latest is itself a delta
    const deltaManifestBuf = files.get('meta/delta-manifest.json');

    if (deltaManifestBuf) {
      const delta = JSON.parse(deltaManifestBuf.toString('utf-8')) as DeltaManifest;
      return {
        hashes: delta.resultHashes,
        parentId: latest.id,
        baseId: delta.baseId,
        chainDepth: delta.chainDepth + 1,
      };
    }

    // Full snapshot — compute hashes from the file map
    const hashes = computeContentHashes(files);
    return {
      hashes,
      parentId: latest.id,
      baseId: latest.id,
      chainDepth: 1,
    };
  } catch {
    // Can't load parent — force full snapshot
    return null;
  }
}

/**
 * Check if a snapshot is incremental (has a delta manifest).
 */
export function isIncremental(files: Map<string, Buffer>): boolean {
  return files.has('meta/delta-manifest.json');
}

/**
 * Get the delta manifest from an unpacked archive, if present.
 */
export function getDeltaManifest(files: Map<string, Buffer>): DeltaManifest | null {
  const buf = files.get('meta/delta-manifest.json');
  if (!buf) return null;
  return JSON.parse(buf.toString('utf-8')) as DeltaManifest;
}
