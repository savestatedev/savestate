/**
 * SaveState Snapshot Creation
 *
 * Collects state from an adapter, builds the SAF structure,
 * encrypts it, and stores it in the configured backend.
 */

import type { Adapter, SaveStateConfig, Snapshot } from './types.js';
import { generateSnapshotId, SAF_VERSION } from './format.js';

/**
 * Create a new snapshot by extracting state from an adapter.
 *
 * Flow:
 * 1. Adapter extracts current state from the platform
 * 2. Build SAF archive structure
 * 3. Compute incremental diff if previous snapshot exists
 * 4. Pack → compress → encrypt → store
 *
 * @param config - SaveState configuration
 * @param adapter - Platform adapter to extract state from
 * @param options - Snapshot options
 * @returns The created snapshot
 */
export async function createSnapshot(
  config: SaveStateConfig,
  adapter: Adapter,
  options?: {
    label?: string;
    tags?: string[];
    parentId?: string;
  },
): Promise<Snapshot> {
  // Step 1: Extract state from the platform
  const snapshot = await adapter.extract();

  // Step 2: Enrich manifest
  snapshot.manifest = {
    ...snapshot.manifest,
    id: generateSnapshotId(),
    version: SAF_VERSION,
    timestamp: new Date().toISOString(),
    adapter: adapter.id,
    platform: adapter.platform,
    label: options?.label ?? snapshot.manifest.label,
    tags: options?.tags ?? snapshot.manifest.tags,
    parent: options?.parentId,
  };

  // Step 3: Update snapshot chain
  snapshot.chain = {
    current: snapshot.manifest.id,
    parent: options?.parentId,
    ancestors: options?.parentId
      ? [...(snapshot.chain?.ancestors ?? []), options.parentId]
      : [],
  };

  // TODO: Step 4 — Compute incremental diff against parent
  // TODO: Step 5 — Pack, compress, encrypt, store

  return snapshot;
}

/**
 * Get the latest snapshot ID from storage.
 */
export async function getLatestSnapshotId(
  _config: SaveStateConfig,
): Promise<string | null> {
  // TODO: Query storage backend for most recent snapshot
  return null;
}
