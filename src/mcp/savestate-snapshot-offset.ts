const MAX_SAVESTATE_SNAPSHOT_OFFSET = 1000;

/** Parse savestate_snapshot offset without turning user input errors into an unbounded skip. */
export function parseSavestateSnapshotOffset(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 0 || value > MAX_SAVESTATE_SNAPSHOT_OFFSET) {
    throw new Error(
      `Invalid offset value "${value}". Expected a non-negative integer up to ${MAX_SAVESTATE_SNAPSHOT_OFFSET}.`,
    );
  }
  return value;
}

/** Skip the first N status field rows when savestate_snapshot offset is set. */
export function selectSavestateSnapshotOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}
