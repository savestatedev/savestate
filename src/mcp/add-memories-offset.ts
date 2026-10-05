const MAX_ADD_MEMORIES_OFFSET = 1000;

/** Parse add_memories offset without turning user input errors into an unbounded skip. */
export function parseAddMemoriesOffset(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 0 || value > MAX_ADD_MEMORIES_OFFSET) {
    throw new Error(
      `Invalid offset value "${value}". Expected a non-negative integer up to ${MAX_ADD_MEMORIES_OFFSET}.`,
    );
  }
  return value;
}

/** Skip the first N memories when add_memories offset is set. */
export function selectAddMemoriesOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}
