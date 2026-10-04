const MAX_SAVESTATE_STATS_OFFSET = 1000;

/** Parse savestate_stats offset without turning user input errors into an unbounded skip. */
export function parseSavestateStatsOffset(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 0 || value > MAX_SAVESTATE_STATS_OFFSET) {
    throw new Error(
      `Invalid offset value "${value}". Expected a non-negative integer up to ${MAX_SAVESTATE_STATS_OFFSET}.`,
    );
  }
  return value;
}

/** Skip the first N snapshots when savestate_stats offset is set. */
export function selectSavestateStatsOffsetEntries<T>(entries: T[], offset?: number): T[] {
  if (offset === undefined) return entries;
  return entries.slice(offset);
}
