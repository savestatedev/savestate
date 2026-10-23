const MAX_MEMORIES_RESOURCE_LIMIT = 1000;

export interface MemoriesResourcePage<T> {
  count: number;
  total: number;
  /** Number of memories after the visible page. */
  remaining: number;
  offset: number;
  pageSize: number;
  page: number;
  totalPages: number;
  nextOffset: number | null;
  nextUri: string | null;
  previousOffset: number | null;
  previousUri: string | null;
  suggestedOffset: number | null;
  suggestedUri: string | null;
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
  const suggestedOffset = selected.length === 0 && total > 0
    ? Math.floor((total - 1) / pageSize) * pageSize
    : null;
  const previousOffset = start > 0
    ? selected.length === 0 && suggestedOffset !== null
      ? suggestedOffset
      : Math.max(0, start - pageSize)
    : null;
  const previousUri = previousOffset === null
    ? null
    : `${resourceUri}?offset=${previousOffset}&limit=${pageSize}`;
  const suggestedUri = suggestedOffset === null
    ? null
    : `${resourceUri}?offset=${suggestedOffset}&limit=${pageSize}`;

  return {
    count: selected.length,
    total,
    remaining: Math.max(0, total - start - selected.length),
    offset: start,
    pageSize,
    page: Math.floor(start / pageSize) + 1,
    totalPages: Math.ceil(total / pageSize),
    nextOffset,
    nextUri: nextOffset === null ? null : `${resourceUri}?offset=${nextOffset}&limit=${pageSize}`,
    previousOffset,
    previousUri,
    suggestedOffset,
    suggestedUri,
    entries: selected,
  };
}
