const MAX_SAVESTATE_LIST_OFFSET = 1000;

/** Parse savestate_list offset without turning user input errors into an unbounded skip. */
export function parseSavestateListOffset(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 0 || value > MAX_SAVESTATE_LIST_OFFSET) {
    throw new Error(
      `Invalid offset value "${value}". Expected a non-negative integer up to ${MAX_SAVESTATE_LIST_OFFSET}.`,
    );
  }
  return value;
}

/** Skip the first N snapshots when savestate_list offset is set. */
export function selectSavestateListOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}
