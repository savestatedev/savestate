const MAX_SAVESTATE_STATUS_OFFSET = 1000;

/** Parse savestate_status offset without turning user input errors into an unbounded skip. */
export function parseSavestateStatusOffset(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 0 || value > MAX_SAVESTATE_STATUS_OFFSET) {
    throw new Error(
      `Invalid offset value "${value}". Expected a non-negative integer up to ${MAX_SAVESTATE_STATUS_OFFSET}.`,
    );
  }
  return value;
}

/** Skip the first N status field rows when savestate_status offset is set. */
export function selectSavestateStatusOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}
