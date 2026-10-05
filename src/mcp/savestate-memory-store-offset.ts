const MAX_SAVESTATE_MEMORY_STORE_OFFSET = 1000;

/** Parse savestate_memory_store offset without turning user input errors into an unbounded skip. */
export function parseSavestateMemoryStoreOffset(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 0 || value > MAX_SAVESTATE_MEMORY_STORE_OFFSET) {
    throw new Error(
      `Invalid offset value "${value}". Expected a non-negative integer up to ${MAX_SAVESTATE_MEMORY_STORE_OFFSET}.`,
    );
  }
  return value;
}

/** Skip the first N confirmation field rows when savestate_memory_store offset is set. */
export function selectSavestateMemoryStoreOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}
