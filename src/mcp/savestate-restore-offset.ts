const MAX_SAVESTATE_RESTORE_OFFSET = 1000;

/** Parse savestate_restore offset without turning user input errors into an unbounded skip. */
export function parseSavestateRestoreOffset(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 0 || value > MAX_SAVESTATE_RESTORE_OFFSET) {
    throw new Error(
      `Invalid offset value "${value}". Expected a non-negative integer up to ${MAX_SAVESTATE_RESTORE_OFFSET}.`,
    );
  }
  return value;
}

/** Skip the first N status field rows when savestate_restore offset is set. */
export function selectSavestateRestoreOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}
