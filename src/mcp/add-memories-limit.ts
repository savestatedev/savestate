const MAX_ADD_MEMORIES_LIMIT = 1000;

/** Parse add_memories limit without turning user input errors into an unbounded write. */
export function parseAddMemoriesLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 1 || value > MAX_ADD_MEMORIES_LIMIT) {
    throw new Error(
      `Invalid limit value "${value}". Expected a positive integer up to ${MAX_ADD_MEMORIES_LIMIT}.`,
    );
  }
  return value;
}

/** Keep the first N memories when add_memories limit is set. */
export function selectAddMemoriesEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}
