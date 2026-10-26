const MAX_LIST_MEMORIES_LIMIT = 1000;

export interface ListMemoriesFilters {
  type?: string;
  source?: string;
  tags?: string[];
  minImportance?: number;
  maxImportance?: number;
  search?: string;
  since?: string;
  until?: string;
}

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
  const previous = start > 0
    ? `; previous offset ${Math.max(0, start - pageSize)}`
    : '';
  const more = hasMore ? `; next offset ${start + shown}; more available` : '';
  return `Memories (${shown} shown of ${total} total, starting at ${start}${previous}${more}):`;
}

/** Explain an empty page and point callers at the nearest populated page. */
export function formatListMemoriesEmptyPage(
  total: number,
  offset: number | undefined,
  limit?: number,
  filters?: ListMemoriesFilters,
): string {
  const start = offset ?? 0;
  const activeFilters = formatListMemoriesFilters(filters);
  const filterSummary = activeFilters.length > 0
    ? ` Active filters: ${activeFilters}.`
    : '';
  if (total === 0) {
    return filterSummary.length > 0
      ? `No memories found at offset ${start}. Total matching: 0.${filterSummary}`
      : `No memories found at offset ${start}. Total matching: 0`;
  }

  const pageSize = limit ?? 50;
  const suggestedOffset = Math.floor((total - 1) / pageSize) * pageSize;
  return `No memories found at offset ${start}. Total matching: ${total}.${filterSummary} ` +
    `Suggested offset ${suggestedOffset} with limit ${pageSize} opens the nearest available page.`;
}

/** Keep empty MCP responses self-describing when a filtered query has no page. */
export function formatListMemoriesFilters(filters?: ListMemoriesFilters): string {
  if (!filters) return '';

  const parts: string[] = [];
  if (filters.type) parts.push(`type=${filters.type}`);
  if (filters.source) parts.push(`source=${filters.source}`);
  if (filters.tags?.length) parts.push(`tags=[${filters.tags.join(', ')}]`);
  if (filters.search) parts.push(`search="${filters.search}"`);
  if (filters.minImportance !== undefined) parts.push(`minImportance=${filters.minImportance}`);
  if (filters.maxImportance !== undefined) parts.push(`maxImportance=${filters.maxImportance}`);
  if (filters.since) parts.push(`since=${filters.since}`);
  if (filters.until) parts.push(`until=${filters.until}`);
  return parts.join(', ');
}
