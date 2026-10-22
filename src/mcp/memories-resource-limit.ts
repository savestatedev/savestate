const MAX_MEMORIES_RESOURCE_LIMIT = 1000;

export interface MemoriesResourcePage<T> {
  count: number;
  total: number;
  offset: number;
  nextOffset: number | null;
  nextUri: string | null;
  previousOffset: number | null;
  suggestedOffset: number | null;
  entries: T[];
}

/** Parse savestate://memories limit without turning user input errors into an unbounded memory dump. */
export function parseMemoriesResourceLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 1 || value > MAX_MEMORIES_RESOURCE_LIMIT) {
    throw new Error(
      `Invalid limit value "${value}". Expected a positive integer up to ${MAX_MEMORIES_RESOURCE_LIMIT}.`,
    );
  }
  return value;
}

/** Keep the first N memories when savestate://memories limit is set. */
export function selectMemoriesResourceEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

/** Build a bounded memory resource page with enough metadata for clients to continue. */
export function buildMemoriesResourcePage<T>(
  entries: T[],
  total: number,
  offset: number | undefined,
  limit: number | undefined,
  resourceUri = 'savestate://memories',
): MemoriesResourcePage<T> {
  const start = offset ?? 0;
  const pageSize = limit ?? 50;
  const selected = selectMemoriesResourceEntries(entries.slice(start), pageSize);
  const nextOffset = start + selected.length < total
    ? start + selected.length
    : null;
  const previousOffset = start > 0 ? Math.max(0, start - pageSize) : null;
  const suggestedOffset = selected.length === 0 && total > 0
    ? Math.floor((total - 1) / pageSize) * pageSize
    : null;

  return {
    count: selected.length,
    total,
    offset: start,
    nextOffset,
    nextUri: nextOffset === null ? null : `${resourceUri}?offset=${nextOffset}&limit=${pageSize}`,
    previousOffset,
    suggestedOffset,
    entries: selected,
  };
}
