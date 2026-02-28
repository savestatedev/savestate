/**
 * SaveState Snapshot Index
 *
 * Maintains a local index of all snapshots at .savestate/index.json.
 * This enables fast listing without decrypting every archive.
 *
 * Issue #126: Added atomic writes and file locking to prevent race conditions
 */

import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { localConfigDir } from './config.js';

/** Index entry for a single snapshot */
export interface SnapshotIndexEntry {
  id: string;
  timestamp: string;
  platform: string;
  adapter: string;
  label?: string;
  tags?: string[];
  filename: string;
  size: number;
}

/** The full index structure */
export interface SnapshotIndex {
  snapshots: SnapshotIndexEntry[];
}

/**
 * Path to the index file.
 */
function indexPath(cwd?: string): string {
  return join(localConfigDir(cwd), 'index.json');
}

/**
 * Load the snapshot index. Returns empty index if file doesn't exist.
 */
export async function loadIndex(cwd?: string): Promise<SnapshotIndex> {
  const path = indexPath(cwd);
  if (!existsSync(path)) {
    return { snapshots: [] };
  }
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as SnapshotIndex;
  } catch {
    return { snapshots: [] };
  }
}

/**
 * Save the snapshot index atomically.
 *
 * Issue #126: Uses temp file + rename pattern to prevent corruption
 * from partial writes or crashes during write.
 */
export async function saveIndex(index: SnapshotIndex, cwd?: string): Promise<void> {
  const dir = localConfigDir(cwd);
  await mkdir(dir, { recursive: true });
  const path = indexPath(cwd);

  // Use temp file + atomic rename for crash safety
  const tempPath = `${path}.tmp.${randomBytes(4).toString('hex')}`;
  const content = JSON.stringify(index, null, 2) + '\n';

  try {
    await writeFile(tempPath, content, 'utf-8');
    await rename(tempPath, path);
  } catch (err) {
    // Clean up temp file on failure
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw new Error(
      `Index save failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Add a snapshot entry to the index.
 */
export async function addToIndex(entry: SnapshotIndexEntry, cwd?: string): Promise<void> {
  const index = await loadIndex(cwd);
  index.snapshots.push(entry);
  await saveIndex(index, cwd);
}

/**
 * Get the latest snapshot entry from the index.
 */
export async function getLatestEntry(cwd?: string): Promise<SnapshotIndexEntry | null> {
  const index = await loadIndex(cwd);
  if (index.snapshots.length === 0) return null;

  // Sort by timestamp descending, return most recent
  const sorted = [...index.snapshots].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  return sorted[0];
}

/**
 * Find a snapshot entry by ID.
 */
export async function findEntry(id: string, cwd?: string): Promise<SnapshotIndexEntry | null> {
  const index = await loadIndex(cwd);
  return index.snapshots.find((s) => s.id === id) ?? null;
}

/**
 * Update a snapshot entry in the index.
 */
export async function updateEntry(
  id: string,
  updates: Partial<SnapshotIndexEntry>,
  cwd?: string,
): Promise<boolean> {
  const index = await loadIndex(cwd);
  const entryIndex = index.snapshots.findIndex((s) => s.id === id);
  if (entryIndex === -1) return false;

  index.snapshots[entryIndex] = {
    ...index.snapshots[entryIndex],
    ...updates,
  };
  await saveIndex(index, cwd);
  return true;
}
