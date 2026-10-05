const MAX_DELETE_ALL_MEMORIES_OFFSET = 1000;

/** Parse delete_all_memories offset without turning user input errors into an unbounded skip. */
export function parseDeleteAllMemoriesOffset(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 0 || value > MAX_DELETE_ALL_MEMORIES_OFFSET) {
    throw new Error(
      `Invalid offset value "${value}". Expected a non-negative integer up to ${MAX_DELETE_ALL_MEMORIES_OFFSET}.`,
    );
  }
  return value;
}

/** Skip the first N memories when delete_all_memories offset is set. */
export function selectDeleteAllMemoriesOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}
