const MAX_LIST_MEMORIES_OFFSET = 1000;

/** Parse list_memories offset without turning user input errors into an unbounded skip. */
export function parseListMemoriesOffset(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 0 || value > MAX_LIST_MEMORIES_OFFSET) {
    throw new Error(
      `Invalid offset value "${value}". Expected a non-negative integer up to ${MAX_LIST_MEMORIES_OFFSET}.`,
    );
  }
  return value;
}

/** Skip the first N memories when list_memories offset is set. */
export function selectListMemoriesOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}
