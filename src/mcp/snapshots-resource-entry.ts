import type { SnapshotIndexEntry } from '../index-file.js';

export interface SnapshotsResourceEntry {
  id: string;
  timestamp: string;
  platform: string;
  adapter: string;
  label?: string;
  size: number;
}

/** Expose the source adapter so snapshot resource consumers can identify each entry. */
export function formatSnapshotsResourceEntry(entry: SnapshotIndexEntry): SnapshotsResourceEntry {
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    platform: entry.platform,
    adapter: entry.adapter,
    label: entry.label,
    size: entry.size,
  };
}
