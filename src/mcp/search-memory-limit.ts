const MAX_SEARCH_MEMORY_LIMIT = 1000;

/** Parse search_memory limit without turning user input errors into an empty memory search. */
export function parseSearchMemoryLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 1 || value > MAX_SEARCH_MEMORY_LIMIT) {
    throw new Error(
      `Invalid limit value "${value}". Expected a positive integer up to ${MAX_SEARCH_MEMORY_LIMIT}.`,
    );
  }
  return value;
}

/** Keep the first N memories when search_memory limit is set. */
export function selectSearchMemoryEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}
