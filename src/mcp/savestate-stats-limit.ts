const MAX_SAVESTATE_STATS_LIMIT = 1000;

/** Parse savestate_stats limit without turning user input errors into unbounded usage stats. */
export function parseSavestateStatsLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 1 || value > MAX_SAVESTATE_STATS_LIMIT) {
    throw new Error(
      `Invalid limit value "${value}". Expected a positive integer up to ${MAX_SAVESTATE_STATS_LIMIT}.`,
    );
  }
  return value;
}

/** Keep the first N snapshots when savestate_stats limit is set. */
export function selectSavestateStatsEntries<T>(entries: T[], limit?: number): T[] {
  if (limit === undefined) return entries;
  return entries.slice(0, limit);
}
