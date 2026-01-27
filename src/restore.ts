/**
 * SaveState Restore
 *
 * Decrypts and unpacks a SAF archive, then feeds the state
 * back through an adapter to restore it on the target platform.
 */

import type { Adapter, SaveStateConfig, Snapshot } from './types.js';

/**
 * Restore from a snapshot.
 *
 * Flow:
 * 1. Retrieve encrypted archive from storage
 * 2. Decrypt with user passphrase
 * 3. Decompress and unpack SAF structure
 * 4. Feed state through adapter's restore method
 *
 * @param snapshotId - ID of the snapshot to restore (or 'latest')
 * @param config - SaveState configuration
 * @param adapter - Platform adapter to restore state through
 * @param options - Restore options
 */
export async function restoreSnapshot(
  snapshotId: string,
  config: SaveStateConfig,
  adapter: Adapter,
  _options?: {
    /** Only restore specific categories */
    include?: ('identity' | 'memory' | 'conversations')[];
    /** Dry run — show what would be restored without doing it */
    dryRun?: boolean;
  },
): Promise<void> {
  // TODO: Step 1 — Resolve 'latest' to actual snapshot ID
  const _resolvedId = snapshotId === 'latest' ? await resolveLatest(config) : snapshotId;

  // TODO: Step 2 — Retrieve from storage backend
  // TODO: Step 3 — Decrypt
  // TODO: Step 4 — Unpack SAF
  // TODO: Step 5 — Feed through adapter.restore()

  void adapter;
  void config;
}

/**
 * Resolve 'latest' to the most recent snapshot ID.
 */
async function resolveLatest(_config: SaveStateConfig): Promise<string> {
  // TODO: Query storage for most recent snapshot
  throw new Error('No snapshots found. Run `savestate snapshot` first.');
}

/**
 * Validate a snapshot's integrity before restoring.
 */
export async function validateSnapshot(_snapshot: Snapshot): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // TODO: Verify checksum
  // TODO: Verify manifest completeness
  // TODO: Verify snapshot chain integrity

  return {
    valid: errors.length === 0,
    errors,
  };
}
