const MAX_SAVESTATE_MEMORY_SEARCH_OFFSET = 1000;

/** Parse savestate_memory_search offset without turning user input errors into an unbounded skip. */
export function parseSavestateMemorySearchOffset(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 0 || value > MAX_SAVESTATE_MEMORY_SEARCH_OFFSET) {
    throw new Error(
      `Invalid offset value "${value}". Expected a non-negative integer up to ${MAX_SAVESTATE_MEMORY_SEARCH_OFFSET}.`,
    );
  }
  return value;
}

/** Skip the first N memories when savestate_memory_search offset is set. */
export function selectSavestateMemorySearchOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}
