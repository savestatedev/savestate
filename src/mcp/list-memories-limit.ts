const MAX_LIST_MEMORIES_LIMIT = 1000;

/** Parse list_memories limit without turning user input errors into an empty memory list. */
export function parseListMemoriesLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 1 || value > MAX_LIST_MEMORIES_LIMIT) {
    throw new Error(
      `Invalid limit value "${value}". Expected a positive integer up to ${MAX_LIST_MEMORIES_LIMIT}.`,
    );
  }
  return value;
}

/** Keep the first N memories when list_memories limit is set. */
export function selectListMemoriesEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}

/** Format a compact page summary for MCP clients and humans reading the tool response. */
export function formatListMemoriesPageSummary(
  shown: number,
  total: number,
  offset: number | undefined,
  hasMore: boolean,
): string {
  const start = offset ?? 0;
  const more = hasMore ? '; more available' : '';
  return `Memories (${shown} shown of ${total} total, starting at ${start}${more}):`;
}
