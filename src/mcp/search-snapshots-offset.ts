const MAX_SEARCH_SNAPSHOTS_OFFSET = 1000;

/** Parse savestate_search_snapshots offset without turning user input errors into an unbounded skip. */
export function parseSearchSnapshotsOffset(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 0 || value > MAX_SEARCH_SNAPSHOTS_OFFSET) {
    throw new Error(
      `Invalid offset value "${value}". Expected a non-negative integer up to ${MAX_SEARCH_SNAPSHOTS_OFFSET}.`,
    );
  }
  return value;
}

/** Skip the first N matches when savestate_search_snapshots offset is set. */
export function selectSearchSnapshotsOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}
