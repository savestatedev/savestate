/**
 * SaveState Snapshot Index
 *
 * Maintains a local index of all snapshots at .savestate/index.json.
 * This enables fast listing without decrypting every archive.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
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
 * Save the snapshot index.
 */
export async function saveIndex(index: SnapshotIndex, cwd?: string): Promise<void> {
  const dir = localConfigDir(cwd);
  await mkdir(dir, { recursive: true });
  const path = indexPath(cwd);
  await writeFile(path, JSON.stringify(index, null, 2) + '\n', 'utf-8');
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
