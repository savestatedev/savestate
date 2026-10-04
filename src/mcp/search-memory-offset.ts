const MAX_SEARCH_MEMORY_OFFSET = 1000;

/** Parse search_memory offset without turning user input errors into an unbounded skip. */
export function parseSearchMemoryOffset(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 0 || value > MAX_SEARCH_MEMORY_OFFSET) {
    throw new Error(
      `Invalid offset value "${value}". Expected a non-negative integer up to ${MAX_SEARCH_MEMORY_OFFSET}.`,
    );
  }
  return value;
}

/** Skip the first N memories when search_memory offset is set. */
export function selectSearchMemoryOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}
