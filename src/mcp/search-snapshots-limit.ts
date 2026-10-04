const MAX_SEARCH_SNAPSHOTS_LIMIT = 1000;

/** Parse savestate_search_snapshots limit without turning user input errors into an unbounded snapshot search. */
export function parseSearchSnapshotsLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 1 || value > MAX_SEARCH_SNAPSHOTS_LIMIT) {
    throw new Error(
      `Invalid limit value "${value}". Expected a positive integer up to ${MAX_SEARCH_SNAPSHOTS_LIMIT}.`,
    );
  }
  return value;
}

/** Keep the first N matches when savestate_search_snapshots limit is set. */
export function selectSearchSnapshotsEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}
