import type { SnapshotIndexEntry } from '../index-file.js';
import {
  normalizeSnapshotsResourceLabel,
  normalizeSnapshotsResourceTags,
} from './snapshots-resource-filters.js';

export interface SnapshotsResourceEntry {
  id: string;
  timestamp: string;
  platform: string;
  adapter: string;
  label: string | null;
  tags: string[];
  size: number;
}

/** Expose the source adapter so snapshot resource consumers can identify each entry. */
export function formatSnapshotsResourceEntry(entry: SnapshotIndexEntry): SnapshotsResourceEntry {
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    platform: entry.platform,
    adapter: entry.adapter,
    label: normalizeSnapshotsResourceLabel(entry.label),
    tags: normalizeSnapshotsResourceTags(entry.tags),
    size: entry.size,
  };
}
