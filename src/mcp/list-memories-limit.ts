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
  pageSize = Math.max(1, shown),
): string {
  const start = offset ?? 0;
  const page = Math.floor(start / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);
  const previous = start > 0
    ? `; previous offset ${Math.max(0, start - pageSize)}`
    : '';
  const more = hasMore ? `; next offset ${start + shown}; more available` : '';
  return `Memories (${shown} shown of ${total} total, page ${page} of ${totalPages}, starting at ${start}${previous}${more}):`;
}

/** Explain an empty page and point callers at the nearest populated page. */
export function formatListMemoriesEmptyPage(
  total: number,
  offset: number | undefined,
  limit?: number,
): string {
  const start = offset ?? 0;
  if (total === 0) return `No memories found at offset ${start}. Total matching: 0`;

  const pageSize = limit ?? 50;
  const page = Math.floor(start / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);
  const suggestedOffset = Math.floor((total - 1) / pageSize) * pageSize;
  return `No memories found at offset ${start} (requested page ${page}; ${totalPages} pages available). ` +
    `Total matching: ${total}. ` +
    `Suggested offset ${suggestedOffset} with limit ${pageSize} opens the nearest available page.`;
}
