/**
 * SaveState Snapshot Creation
 *
 * Collects state from an adapter, builds the SAF structure,
 * encrypts it, and stores it in the configured backend.
 *
 * Flow:
 * 1. Adapter extracts current state → Snapshot object
 * 2. packSnapshot() → file map
 * 3. packToArchive() → tar.gz buffer
 * 4. Compute checksum, update manifest with size
 * 5. Re-pack with updated manifest
 * 6. encrypt() → encrypted buffer
 * 7. storage.put() with snapshot filename
 * 8. Update local index
 */

import type { Adapter, SaveStateConfig, Snapshot, StorageBackend } from './types.js';
import {
  generateSnapshotId,
  SAF_VERSION,
  packSnapshot,
  packToArchive,
  computeChecksum,
  snapshotFilename,
} from './format.js';
import { encrypt } from './encryption.js';
import { addToIndex } from './index-file.js';
import {
  getParentHashes,
  computeDelta,
  computeContentHashes,
  packDelta,
  type DeltaManifest,
} from './incremental.js';

export interface CreateSnapshotResult {
  snapshot: Snapshot;
  filename: string;
  archiveSize: number;
  encryptedSize: number;
  fileCount: number;
  /** Whether this is an incremental (delta) snapshot */
  incremental: boolean;
  /** Delta stats (only present for incremental snapshots) */
  delta?: {
    added: number;
    modified: number;
    removed: number;
    unchanged: number;
    bytesSaved: number;
    chainDepth: number;
  };
}

/**
 * Create a new snapshot by extracting state from an adapter.
 *
 * Automatically uses incremental snapshots when a parent exists,
 * unless `full` is explicitly requested or the chain is too deep.
 *
 * @param adapter - Platform adapter to extract state from
 * @param storage - Storage backend to write to
 * @param passphrase - Encryption passphrase
 * @param options - Snapshot options (label, tags, full, etc.)
 * @returns Details about the created snapshot
 */
export async function createSnapshot(
  adapter: Adapter,
  storage: StorageBackend,
  passphrase: string,
  options?: {
    label?: string;
    tags?: string[];
    parentId?: string;
    /** Force a full snapshot (skip incremental) */
    full?: boolean;
  },
): Promise<CreateSnapshotResult> {
  // Step 1: Extract state from the platform
  const snapshot = await adapter.extract();

  // Step 2: Enrich manifest
  const snapshotId = generateSnapshotId();
  const now = new Date().toISOString();

  // Step 3: Check for incremental opportunity
  let parentInfo: Awaited<ReturnType<typeof getParentHashes>> = null;
  if (!options?.full) {
    try {
      parentInfo = await getParentHashes(storage, passphrase);
    } catch {
      // Can't load parent — proceed with full snapshot
    }
  }

  // Step 4: Pack the full snapshot to get file map
  // (we need this regardless — for delta comparison or full storage)
  const fullFileMap = packSnapshot(snapshot);

  // Step 5: Determine if we should do incremental or full
  let deltaManifest: DeltaManifest | undefined;
  let deltaResult: ReturnType<typeof computeDelta> | undefined;
  let isIncremental = false;

  if (parentInfo) {
    deltaResult = computeDelta(
      fullFileMap,
      parentInfo.hashes,
      parentInfo.parentId,
      parentInfo.baseId,
      parentInfo.chainDepth,
    );

    if (!deltaResult.shouldForceFull) {
      isIncremental = true;
      deltaManifest = deltaResult.delta;
    }
  }

  // Step 6: Set manifest with parent reference
  snapshot.manifest = {
    ...snapshot.manifest,
    id: snapshotId,
    version: SAF_VERSION,
    timestamp: now,
    adapter: adapter.id,
    platform: adapter.platform,
    label: options?.label ?? snapshot.manifest.label,
    tags: options?.tags ?? snapshot.manifest.tags,
    parent: isIncremental ? parentInfo!.parentId : options?.parentId,
  };

  // Step 7: Update snapshot chain
  snapshot.chain = {
    current: snapshotId,
    parent: isIncremental ? parentInfo!.parentId : options?.parentId,
    ancestors: isIncremental
      ? [...(deltaManifest!.chainDepth > 1
          ? (await getChainAncestors(parentInfo!.parentId))
          : []), parentInfo!.parentId]
      : options?.parentId
        ? [...(snapshot.chain?.ancestors ?? []), options.parentId]
        : [],
  };

  // Step 8: Pack the archive (incremental or full)
  let archiveFileMap: Map<string, Buffer>;

  if (isIncremental && deltaResult && deltaManifest) {
    archiveFileMap = packDelta(snapshot, deltaManifest, deltaResult.changedFiles);
  } else {
    archiveFileMap = packSnapshot(snapshot);
  }

  // Step 9: Compute checksum and finalize
  const firstArchive = packToArchive(archiveFileMap);
  const checksum = computeChecksum(firstArchive);

  snapshot.manifest.checksum = checksum;
  snapshot.manifest.size = firstArchive.length;

  // Re-pack with updated manifest
  if (isIncremental && deltaResult && deltaManifest) {
    archiveFileMap.set('manifest.json', Buffer.from(JSON.stringify(snapshot.manifest, null, 2)));
  } else {
    archiveFileMap = packSnapshot(snapshot);
  }

  const finalArchive = packToArchive(archiveFileMap);

  // Step 10: Encrypt
  const encrypted = await encrypt(finalArchive, passphrase);

  // Step 11: Store
  const filename = snapshotFilename(snapshotId);
  await storage.put(filename, encrypted);

  // Step 12: Update local index
  await addToIndex({
    id: snapshotId,
    timestamp: now,
    platform: adapter.platform,
    adapter: adapter.id,
    label: options?.label,
    tags: options?.tags,
    filename,
    size: encrypted.length,
  });

  return {
    snapshot,
    filename,
    archiveSize: finalArchive.length,
    encryptedSize: encrypted.length,
    fileCount: archiveFileMap.size,
    incremental: isIncremental,
    delta: isIncremental && deltaManifest
      ? {
          added: deltaManifest.stats.added,
          modified: deltaManifest.stats.modified,
          removed: deltaManifest.stats.removed,
          unchanged: deltaManifest.stats.unchanged,
          bytesSaved: deltaManifest.stats.bytesSaved,
          chainDepth: deltaManifest.chainDepth,
        }
      : undefined,
  };
}

/**
 * Helper: get the chain ancestors for a given snapshot ID.
 */
async function getChainAncestors(snapshotId: string): Promise<string[]> {
  const index = await import('./index-file.js');
  // We don't need to decrypt the full chain — just track IDs from the index
  // For now, return empty. The chain info is primarily in meta/snapshot-chain.json
  return [];
}

/**
 * Get the latest snapshot ID from the index.
 */
export async function getLatestSnapshotId(): Promise<string | null> {
  const { getLatestEntry } = await import('./index-file.js');
  const entry = await getLatestEntry();
  return entry?.id ?? null;
}
