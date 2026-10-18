const MAX_SNAPSHOTS_RESOURCE_LIMIT = 1000;

export interface SnapshotsResourcePage<T> {
  count: number;
  total: number;
  offset: number;
  nextOffset: number | null;
  nextUri: string | null;
  entries: T[];
}

/** Parse savestate://snapshots limit without turning user input errors into an unbounded snapshot dump. */
export function parseSnapshotsResourceLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 1 || value > MAX_SNAPSHOTS_RESOURCE_LIMIT) {
    throw new Error(
      `Invalid limit value "${value}". Expected a positive integer up to ${MAX_SNAPSHOTS_RESOURCE_LIMIT}.`,
    );
  }
  return value;
}

/** Keep the first N snapshots when savestate://snapshots limit is set. */
export function selectSnapshotsResourceEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

/** Build a bounded snapshot resource page with enough metadata for clients to continue. */
export function buildSnapshotsResourcePage<T>(
  entries: T[],
  offset: number | undefined,
  limit: number | undefined,
  resourceUri = 'savestate://snapshots',
): SnapshotsResourcePage<T> {
  const start = offset ?? 0;
  const pageSize = limit ?? 50;
  const selected = selectSnapshotsResourceEntries(entries.slice(start), pageSize);
  const nextOffset = start + selected.length < entries.length
    ? start + selected.length
    : null;

  return {
    count: selected.length,
    total: entries.length,
    offset: start,
    nextOffset,
    nextUri: nextOffset === null ? null : `${resourceUri}?offset=${nextOffset}&limit=${pageSize}`,
    entries: selected,
  };
}
