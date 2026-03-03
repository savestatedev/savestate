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
 * 8. Verify write succeeded (Issue #126)
 * 9. Generate save receipt (Issue #126)
 * 10. Update local index
 *
 * Issue #126: Added write verification and save receipts
 */

import type { Adapter, SaveStateConfig, Snapshot, StorageBackend } from './types.js';
import type { StateEventStore } from './state-events/store.js';
import { STATE_EVENTS_VERSION } from './state-events/types.js';
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
import {
  generateReceipt,
  storeReceipt,
  logAudit,
  type SaveReceipt,
} from './save-receipt.js';

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
  /** Save receipt for verification (Issue #126) */
  receipt: SaveReceipt;
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
    /** State events to include in snapshot (Issue #91) */
    stateEvents?: StateEventStore;
  },
): Promise<CreateSnapshotResult> {
  // Step 1: Extract state from the platform
  const snapshot = await adapter.extract();

  // Step 2: Enrich manifest
  const snapshotId = generateSnapshotId();
  const now = new Date().toISOString();

  // Step 3: Check for incremental opportunity
  // Issue #126: Log failures instead of silently catching
  let parentInfo: Awaited<ReturnType<typeof getParentHashes>> = null;
  let parentLoadError: string | undefined;
  if (!options?.full) {
    try {
      parentInfo = await getParentHashes(storage, passphrase);
    } catch (err) {
      // Log the failure for debugging - don't silently swallow errors
      parentLoadError = err instanceof Error ? err.message : String(err);
      logAudit({
        timestamp: new Date().toISOString(),
        operation: 'save',
        resource_id: snapshotId,
        resource_type: 'snapshot',
        success: true, // We'll proceed with full snapshot
        error: `Parent load failed, using full snapshot: ${parentLoadError}`,
      });
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

  // Step 7b: Add state events (Issue #91)
  if (options?.stateEvents && options.stateEvents.count() > 0) {
    snapshot.stateEvents = {
      version: STATE_EVENTS_VERSION,
      count: options.stateEvents.count(),
      events: options.stateEvents.getAll(),
    };
  }

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

  // Step 11: Store with verification (Issue #126)
  const filename = snapshotFilename(snapshotId);
  const saveStartTime = Date.now();

  try {
    // storage.put now includes write verification
    await storage.put(filename, encrypted);
  } catch (err) {
    // Log the failure for audit trail
    logAudit({
      timestamp: new Date().toISOString(),
      operation: 'save',
      resource_id: snapshotId,
      resource_type: 'snapshot',
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration_ms: Date.now() - saveStartTime,
    });
    throw err;
  }

  // Step 12: Generate save receipt (Issue #126)
  const receipt = generateReceipt({
    resourceId: snapshotId,
    resourceType: 'snapshot',
    contentData: finalArchive,
    encryptedData: encrypted,
    storageLocation: filename,
    storageBackend: storage.id,
    savedAt: new Date(now),
    verified: true, // storage.put now verifies
  });

  // Store receipt for later verification
  await storeReceipt(receipt);

  // Step 13: Update local index
  // Issue #126: If index update fails, we have the receipt as backup
  try {
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
  } catch (err) {
    // Log the index failure but don't fail the whole operation
    // The snapshot is saved and we have a receipt
    logAudit({
      timestamp: new Date().toISOString(),
      operation: 'save',
      resource_id: snapshotId,
      resource_type: 'snapshot',
      success: true,
      receipt_id: receipt.receipt_id,
      error: `Index update failed (snapshot saved): ${err instanceof Error ? err.message : String(err)}`,
      duration_ms: Date.now() - saveStartTime,
    });
    // Re-throw to inform caller, but snapshot IS saved
    throw new Error(
      `Snapshot saved successfully (receipt: ${receipt.receipt_id}) but index update failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Log successful save
  logAudit({
    timestamp: new Date().toISOString(),
    operation: 'save',
    resource_id: snapshotId,
    resource_type: 'snapshot',
    success: true,
    receipt_id: receipt.receipt_id,
    duration_ms: Date.now() - saveStartTime,
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
    receipt,
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
