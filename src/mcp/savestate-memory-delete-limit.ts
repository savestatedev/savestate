const MAX_SAVESTATE_MEMORY_DELETE_LIMIT = 1000;

/** Parse savestate_memory_delete limit without turning user input errors into an unbounded confirmation dump. */
export function parseSavestateMemoryDeleteLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 1 || value > MAX_SAVESTATE_MEMORY_DELETE_LIMIT) {
    throw new Error(
      `Invalid limit value "${value}". Expected a positive integer up to ${MAX_SAVESTATE_MEMORY_DELETE_LIMIT}.`,
    );
  }
  return value;
}

/** Keep the first N confirmation field rows when savestate_memory_delete limit is set. */
export function selectSavestateMemoryDeleteEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}
