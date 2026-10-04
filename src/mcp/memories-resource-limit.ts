const MAX_MEMORIES_RESOURCE_LIMIT = 1000;

/** Parse savestate://memories limit without turning user input errors into an unbounded memory dump. */
export function parseMemoriesResourceLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 1 || value > MAX_MEMORIES_RESOURCE_LIMIT) {
    throw new Error(
      `Invalid limit value "${value}". Expected a positive integer up to ${MAX_MEMORIES_RESOURCE_LIMIT}.`,
    );
  }
  return value;
}

/** Keep the first N memories when savestate://memories limit is set. */
export function selectMemoriesResourceEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}
