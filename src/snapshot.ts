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

export interface CreateSnapshotResult {
  snapshot: Snapshot;
  filename: string;
  archiveSize: number;
  encryptedSize: number;
  fileCount: number;
}

/**
 * Create a new snapshot by extracting state from an adapter.
 *
 * @param adapter - Platform adapter to extract state from
 * @param storage - Storage backend to write to
 * @param passphrase - Encryption passphrase
 * @param options - Snapshot options (label, tags, etc.)
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
  },
): Promise<CreateSnapshotResult> {
  // Step 1: Extract state from the platform
  const snapshot = await adapter.extract();

  // Step 2: Enrich manifest
  const snapshotId = generateSnapshotId();
  const now = new Date().toISOString();

  snapshot.manifest = {
    ...snapshot.manifest,
    id: snapshotId,
    version: SAF_VERSION,
    timestamp: now,
    adapter: adapter.id,
    platform: adapter.platform,
    label: options?.label ?? snapshot.manifest.label,
    tags: options?.tags ?? snapshot.manifest.tags,
    parent: options?.parentId,
  };

  // Step 3: Update snapshot chain
  snapshot.chain = {
    current: snapshotId,
    parent: options?.parentId,
    ancestors: options?.parentId
      ? [...(snapshot.chain?.ancestors ?? []), options.parentId]
      : [],
  };

  // Step 4: First pass — pack to get file map and compute checksum
  const fileMap = packSnapshot(snapshot);
  const firstArchive = packToArchive(fileMap);
  const checksum = computeChecksum(firstArchive);

  // Step 5: Update manifest with checksum and size, then re-pack
  snapshot.manifest.checksum = checksum;
  snapshot.manifest.size = firstArchive.length;

  const finalFileMap = packSnapshot(snapshot);
  const finalArchive = packToArchive(finalFileMap);

  // Step 6: Encrypt the archive
  const encrypted = await encrypt(finalArchive, passphrase);

  // Step 7: Store the encrypted archive
  const filename = snapshotFilename(snapshotId);
  await storage.put(filename, encrypted);

  // Step 8: Update local index
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
    fileCount: finalFileMap.size,
  };
}

/**
 * Get the latest snapshot ID from the index.
 */
export async function getLatestSnapshotId(): Promise<string | null> {
  const { getLatestEntry } = await import('./index-file.js');
  const entry = await getLatestEntry();
  return entry?.id ?? null;
}
