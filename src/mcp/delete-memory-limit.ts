const MAX_DELETE_MEMORY_LIMIT = 1000;

/** Parse delete_memory limit without turning user input errors into an unbounded confirmation dump. */
export function parseDeleteMemoryLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 1 || value > MAX_DELETE_MEMORY_LIMIT) {
    throw new Error(
      `Invalid limit value "${value}". Expected a positive integer up to ${MAX_DELETE_MEMORY_LIMIT}.`,
    );
  }
  return value;
}

/** Keep the first N confirmation field rows when delete_memory limit is set. */
export function selectDeleteMemoryEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}
