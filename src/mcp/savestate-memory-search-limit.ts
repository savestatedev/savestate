const MAX_SAVESTATE_MEMORY_SEARCH_LIMIT = 1000;

/** Parse savestate_memory_search limit without turning user input errors into an unbounded memory search. */
export function parseSavestateMemorySearchLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 1 || value > MAX_SAVESTATE_MEMORY_SEARCH_LIMIT) {
    throw new Error(
      `Invalid limit value "${value}". Expected a positive integer up to ${MAX_SAVESTATE_MEMORY_SEARCH_LIMIT}.`,
    );
  }
  return value;
}

/** Keep the first N memories when savestate_memory_search limit is set. */
export function selectSavestateMemorySearchEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}
